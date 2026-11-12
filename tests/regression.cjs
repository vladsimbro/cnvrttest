const {chromium}=require('playwright');
const fs=require('fs');const assert=require('assert');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage();
await page.route('http://cnvrt.test/**',r=>{const name=new URL(r.request().url()).pathname.slice(1)||'index.html';r.fulfill({path:require('path').join(__dirname,'..',name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});});
const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://cnvrt.test/');await page.locator('#convert').waitFor();
const results=[];
for(const input of ['', ' abc\nDEF\r\n\n', '"a",\'b\'\na\\b\t c', '550E8400-E29B-41D4-A716-446655440000\nне uuid\n😀','a\na']){await page.locator('#input').fill(input);await page.locator('#convert').click();results.push(await page.locator('#output').inputValue());}
await page.locator('#tabTree').click();
for(const action of ['disable','enable']) for(const uuids of ['a,b\n"c"','', '550E8400-E29B-41D4-A716-446655440000\nне uuid']){
await page.locator('#treeAction').selectOption(action);await page.locator('#treeUuids').fill(uuids);await page.locator('#treeToken').fill(' a b\t"c ');
await page.evaluate(()=>{document.querySelector('#treeDayDate').value='2026-01-01';document.querySelector('#treeFromDT').value='2025-12-31T23:30';document.querySelector('#treeToDT').value='2026-01-01T01:00';});await page.locator('#treeBuild').click();results.push(await page.locator('#treeOutput').inputValue());}
const target=__dirname+'/baseline.json';if(process.argv.includes('--record'))fs.writeFileSync(target,JSON.stringify(results,null,2));else assert.deepStrictEqual(results,JSON.parse(fs.readFileSync(target)));
assert.deepStrictEqual(errors,[]);console.log('Converter regression: '+results.length+' cases passed');await browser.close();})();
