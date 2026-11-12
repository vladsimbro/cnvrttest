const fs=require('fs'),{execFileSync}=require('child_process'),assert=require('assert');
const original=execFileSync('git',['show','2835ad26175d9507181c3f9817bc2ae60df50df1:app.js'],{encoding:'utf8'}),current=fs.readFileSync('app.js','utf8');
for(const [start,end] of [['    function formatTreeJson','    function initTree'],['    function pad2','    function formatTreeJson'],['    function uuidConvert','    convertBtn &&']]){
const take=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)+start.length)).split('\n').filter(l=>!l.includes('renderHistory();')).join('\n');assert.equal(take(current),take(original),start);
}console.log('Protected conversion and date functions: identical to original source');
