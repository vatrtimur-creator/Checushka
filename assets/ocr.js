/* onWorker — документированное локальное расширение закреплённого Tesseract.js. */
export async function recognizeText(engine, image, options, signal, timeoutMs = 120000) {
  let handle;
  let nativeWorker;
  let timer;
  let abort;
  const stopped = new Promise((resolve, reject) => {
    abort = () => {
      nativeWorker?.terminate();
      reject(new DOMException('OCR cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', abort, {once:true});
    timer = setTimeout(() => { nativeWorker?.terminate(); reject(new Error('OCR timeout')); }, timeoutMs);
  });
  try {
    if (signal.aborted) throw new DOMException('OCR cancelled', 'AbortError');
    handle = await Promise.race([
      engine.createWorker('eng', 1, {
        ...options,
        onWorker: created => { nativeWorker = created; if (signal.aborted) created.terminate(); },
        // Ошибки init возвращаются через исправленный promise createWorker.
        errorHandler: () => {}
      }), stopped
    ]);
    await Promise.race([handle.setParameters({tessedit_pageseg_mode:'11'}), stopped]);
    const {data} = await Promise.race([handle.recognize(image), stopped]);
    return data.text;
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', abort);
    nativeWorker?.terminate();
    if (handle) await handle.terminate().catch(() => {});
  }
}
