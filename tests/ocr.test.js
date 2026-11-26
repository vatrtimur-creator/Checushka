import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {recognizeText} from '../assets/ocr.js';
function mockEngine(mode) {
  let ended = 0;
  return {
    get ended() { return ended; },
    createWorker(lang,oem,options) {
      options.onWorker({terminate:() => ended++});
      if (mode === 'pending') return new Promise(() => {});
      if (mode === 'failure') return Promise.reject(new Error('model missing'));
      return Promise.resolve({setParameters:() => Promise.resolve(),recognize:() => Promise.resolve({data:{text:'76561198755035987'}}),terminate:() => Promise.resolve()});
    }
  };
}
test('OCR returns text and always ends its native worker',async () => {
  const engine = mockEngine('success'); const signal = new AbortController().signal;
  assert.equal(await recognizeText(engine,{}, {},signal),'76561198755035987'); assert.equal(engine.ended,1);
});
test('OCR failure surfaces and cleans initialization worker',async () => {
  const engine = mockEngine('failure');
  await assert.rejects(recognizeText(engine,{}, {},new AbortController().signal),/model missing/); assert.ok(engine.ended >= 1);
});
test('cancel during initialization rejects immediately and ends native worker',async () => {
  const engine = mockEngine('pending'); const controller = new AbortController();
  const result = recognizeText(engine,{}, {},controller.signal); controller.abort();
  await assert.rejects(result,{name:'AbortError'}); assert.ok(engine.ended >= 1);
});
test('hung initialization has bounded time and cleanup',async () => {
  const engine = mockEngine('pending');
  await assert.rejects(recognizeText(engine,{}, {},new AbortController().signal,10),/OCR timeout/); assert.ok(engine.ended >= 1);
});
test('already cancelled run never starts worker',async () => {
  const engine = mockEngine('success'); const controller = new AbortController(); controller.abort();
  await assert.rejects(recognizeText(engine,{}, {},controller.signal),{name:'AbortError'}); assert.equal(engine.ended,0);
});
test('vendored Tesseract rejects language initialization instead of hanging',async () => {
  const source = await readFile(new URL('../assets/vendor/tesseract.min.js',import.meta.url),'utf8');
  let ended = 0;
  class FakeWorker {
    postMessage(job) {
      queueMicrotask(() => this.onmessage?.({data:{...job,status:job.action === 'loadLanguage' ? 'reject' : 'resolve',data:job.action === 'loadLanguage' ? 'missing traineddata' : {}}}));
    }
    terminate() { ended++; }
  }
  const context = {Worker:FakeWorker,URL,Blob,console,Uint8Array,ArrayBuffer,setTimeout,clearTimeout}; context.self = context;
  vm.createContext(context); vm.runInContext(source,context);
  const run = context.Tesseract.createWorker('eng',1,{workerBlobURL:false,workerPath:'https://example.com/worker.js',errorHandler:() => {}});
  await assert.rejects(run,error => error === 'missing traineddata'); assert.ok(ended >= 1);
});
