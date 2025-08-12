const open = require('k6').open;
import http from 'k6/http';

export interface TestFile {
  name: string;
  content: ArrayBuffer;
  mimeType: string;
  size: number;
}

export function loadTestFiles(): Record<string, TestFile> {
  const testFiles: Record<string, TestFile> = {};
  
  try {
    const webpContent = open('../../local/images/default.webp', 'b');
    testFiles.webp = {
      name: 'test.webp',
      content: webpContent,
      mimeType: 'image/webp',
      size: webpContent.byteLength
    };
  } catch (e) {
    console.warn('Could not load default.webp, using fallback');
  }
  
  try {
    const jpegContent = open('../../local/images/jpg.jpg', 'b');
    testFiles.jpeg = {
      name: 'test.jpg',
      content: jpegContent,
      mimeType: 'image/jpeg',
      size: jpegContent.byteLength
    };
  } catch (e) {
    console.warn('Could not load jpg.jpg, using fallback');
  }
  
  try {
    const pngContent = open('../../local/images/test.png', 'b');
    testFiles.png = {
      name: 'test.png',
      content: pngContent,
      mimeType: 'image/png',
      size: pngContent.byteLength
    };
  } catch (e) {
    console.warn('Could not load test.png, using fallback');
  }
  
  try {
    const pdfContent = open('../../local/images/test.pdf', 'b');
    testFiles.pdf = {
      name: 'test.pdf',
      content: pdfContent,
      mimeType: 'application/pdf',
      size: pdfContent.byteLength
    };
  } catch (e) {
    console.warn('Could not load test.pdf, using fallback');
  }

  try {
    const svgContent = open('../../local/images/test.svg', 'b');
    testFiles.svg = {
      name: 'test.svg',
      content: svgContent,
      mimeType: 'image/svg+xml',
      size: svgContent.byteLength
    };
  } catch (e) {
    console.warn('Could not load test.svg, using fallback');
  }
  
  if (Object.keys(testFiles).length === 0) {
    console.error('No test files could be loaded');
  }
  
  return testFiles;
}

export function createFileFormData(
  file: TestFile,
  namespace: string = 'DEV',
  destination?: string,
  toWebp: boolean = true,
  additionalFields?: Record<string, string>
): Record<string, any> {
  
  const timestamp = Date.now();
  const uniqueName = `${file.name.split('.')[0]}_${timestamp}_${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;
  
  const formData: Record<string, any> = {
    file: http.file(file.content, uniqueName, file.mimeType),
    namespace: namespace,
    toWebp: toWebp.toString(),
    information: `Load test file - ${new Date().toISOString()}`
  };
  
  if (destination) {
    formData.destination = destination;
  }
  
  if (additionalFields) {
    Object.assign(formData, additionalFields);
  }
  
  return formData;
}

export function generateRandomDestination(): string {
  const destinations = ['test', 'load-test', 'performance', 'k6-test', 'automation'];
  return destinations[Math.floor(Math.random() * destinations.length)];
}

export function getFileSizeCategory(size: number): string {
  if (size < 100 * 1024) return 'small'; // < 100KB
  if (size < 1024 * 1024) return 'medium'; // < 1MB
  if (size < 5 * 1024 * 1024) return 'large'; // < 5MB
  return 'xlarge'; // >= 5MB
}