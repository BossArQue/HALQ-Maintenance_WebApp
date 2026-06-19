const fs = require('fs');
const content = fs.readFileSync('D:\\OneDrive\\DEEH\\Project\\HALQ-Maintenance_WebApp\\Sample Template\\bootstrap\\dist\\dashboard\\index.html', 'utf-8');
const pretty = content.replace(/(<[^>]+>)/g, '\n$1');
console.log(pretty.substring(0, 8000));
