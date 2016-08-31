# stc-js-tpl-replace
Replace references to templates by their contents in js files

Usage: 

```
    var jsTplReplace = require('stc-js-tpl-replace');

    stc.workflow({
    jsTplReplace: {plugin: jsTplReplace, include: [/resource\/js/, /tpls\//]}
    });
```

Codes above will transfer source js and source template files into output files below:

source js:
```
    var str = $('#myTplId').html();
```
source template:
```
    <script type="text/html" id="myTplId">
        <div>
            something…
        </div>
    </script>
```

output:

js:
```
    var str = "\n    <div>\n        something…\n    </div>\n";
```
tpl:
```
    <nothing here!>
```