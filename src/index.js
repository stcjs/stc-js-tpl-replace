import Plugin from 'stc-plugin';
import {matchAll} from './helper';
import {md5} from 'stc-helper';

const REG = {
  ID: /id\s*=\s*['"]([^'">]+)['"]/,
  JS_ID: /([W$]\(['"]#([^'"]+)['"]\)\.html\(\))/,
  JS_SUFFIX: /\.js$/
}
let tplMap = new Map();
let sourceTplMap = new Map();
export default class jsTplReplace extends Plugin {
  /** 
   * collect script tokens whose `type` is `text/html` or `text/template` by default,
   * put their content into a global map
   * we will use it later
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
      if(token.type === this.TokenType.HTML_TAG_SCRIPT && start.ext.isTpl && !start.ext.isExternal) {
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
      //compare id in js and that in template
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
   * default include
   */
  static include(){
    return [/\.js$/, {type: 'tpl'}];
  }
  /**
   * after handling templates files, 
   * we need to replace strings like `$('#myTplId').html` in js with content collected before,
   * and remove those content in template files.
  **/
  static async after(files, instance) {
   
    for(let index in files) {
      let file = files[index];
      // only replace string in js file
      let REG_JS_SUFFIX = instance.options.JS_SUFFIX || REG.JS_SUFFIX;
      if(!file.path.match(REG_JS_SUFFIX)) {
        continue;
      }

      let content = await file.getContent('utf8');
      let arr = matchAll(content, REG.JS_ID);
     
      if(arr.length) {
        for(let index in arr) {
          let match = arr[index];

          if(match && match[2]) {
            let id = match[2].trim();
            let tplObj = tplMap.get(id);
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