// prototypes/ocrWorker.ts
import Tesseract from 'tesseract.js';

self.onmessage = async (e: MessageEvent<File>) => {
  const file = e.data;
  try {
    const { data } = await Tesseract.recognize(file, 'eng'); // Specify language, e.g., 'eng'
    self.postMessage({ text: data.text });
  } catch (error) {
    console.error('OCR Worker Error:', error);
    // Post an error back to the main thread or handle it as appropriate
    // self.postMessage({ error: 'OCR failed', details: error });
    // For simplicity, just posting empty text on error or rethrow
    self.postMessage({ text: '' }); 
  }
};
