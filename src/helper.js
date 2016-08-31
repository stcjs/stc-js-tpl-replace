export function matchAll(content, reg) {
  let matchResult = [];
  let tmpContent = content;
  while(true) {
    // console.log(tmpContent, reg);
    let match = tmpContent.match(reg);
    if(!match) {
      break;
    }
    tmpContent = tmpContent.replace(match[0], '').trim();
    if(match) {
      matchResult.push(match);
    }
  }
  return matchResult;
}