import Plugin from "stc-plugin";
import {matchAll} from "./helper";

import {md5} from 'stc-helper';
const REG = {
  ID: /id\s*=\s*['"]([^'">]+)['"]/,
  JS_ID: /([W$]\(['"]#([^'"]+)['"]\)\.html\(\))/
}
let tplMap = new Map();
let sourceTplMap = new Map();
// 查找js文件中的$('#tplId').html();
// 根据id 找到对应的tpl模板
// 提取字符串
// 给js文件中的变量赋值成字符串
export default class jsTplReplace extends Plugin {
  /** 
   * 收集模板文件里的模板id和内容
  **/
  async run() {
    if(this.isTpl()) {
      return this.parseJsTplTags();
    }
  }
  async parseJsTplTags() {
    let tokens = await this.getAst();
    let promises = tokens.map(token => {
      let start = token.ext.start;
      let content = token.ext.content;
      if(this.file.path.match(/a\.tpl/)) {
        console.log(this.file.path, token.type === this.TokenType.HTML_TAG_SCRIPT , start.ext.isTpl , !start.ext.isExternal);
      }
      if(token.type === this.TokenType.HTML_TAG_SCRIPT && start.ext.isTpl && !start.ext.isExternal) {
      //  console.log(start.value, this.file.path);
        let val = start.value;
        let matchResult = val.match(REG.ID);
        if(matchResult && matchResult[1] && !content.ext.hasTpl) {
          let id = matchResult[1].trim();
          
          if(tplMap.has(id)) {
            let existedMd5 = md5(tplMap.get(id).content.trim());
            let curMd5 = md5(content.value.trim());
            if(curMd5 !== existedMd5) {
              this.fatal('you have duplicate id: ' + id);
              return;
            }
            tplMap.get(id)['files'].push(this.file);
          } else {
            //get the content, remove the source tpl and add it to the map
            tplMap.set(id, {
              files: [this.file],
              content: content.value
            });
            
          }
        }
      }
    });
    await Promise.all(promises);
  }
  /**
   * remove used script token in tpl files
  **/
  async removeJsTplTags(file, id) {
    let tokens = await file.getAst();

    for(let index in tokens) {
      let curToken = tokens[index];
      let start = curToken.ext.start;
      let content = curToken.ext.content;
      //比较id
      if(curToken.type === this.TokenType.HTML_TAG_SCRIPT && start.ext.isTpl && !start.ext.isExternal) {
        let val = start.value;
        let matchResult = val.match(REG.ID);
        if(matchResult && matchResult[1] && !content.ext.hasTpl) {
          let curId = matchResult[1].trim();
          if(curId === id) {
            tokens.splice(index, 1);
          }
        }
      }
    }
    file.setAst(tokens);
  }
  update(data) {
    if(!data) return;
    if(data.error) {
      this.error(data.error, data.line, data.column);
    }
  }
  /**
   * 集中处理js文件，进行字符串替换
  **/
  static async after(files, instance) {
   
    for(let index in files) {
      let file = files[index];
      let content = await file.getContent('utf8');
      
      let arr = matchAll(content, REG.JS_ID);
     
      if(arr.length) {
        for(let index in arr) {
          let match = arr[index];

          if(match && match[2]) {
            let id = match[2].trim();
            let tplObj = tplMap.get(id);
            // console.log(id, tplMap);
            if(tplMap.has(id)) {
              let jsTplStr = tplObj.content;
              let tplVarRegExp = '[W$]\\([\'"]#'+id+'[\'"]\\)\\.html\\(\\)';
              tplVarRegExp = new RegExp(tplVarRegExp, 'g');

              jsTplStr = jsTplStr.replace(/\n/g, '\\n');
              jsTplStr = jsTplStr.replace(/"/g, '\\"');

              content = content.replace(tplVarRegExp, '"'+jsTplStr+'"');
              // remove the content in tpl file
              let tplFiles = tplObj.files;
              for(let index1 in tplFiles) {
                let tplFile = tplFiles[index1];
                instance.removeJsTplTags(tplFile, id);
              } 
            }
          }
        }
      }
      file.setContent(content);
    }
  }
}