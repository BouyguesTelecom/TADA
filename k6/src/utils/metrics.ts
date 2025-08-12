import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

export const customMetrics = {
  fileUploadErrors: new Counter('file_upload_errors'),
  fileDownloadErrors: new Counter('file_download_errors'),
  catalogErrors: new Counter('catalog_errors'),
  rateLimitHits: new Counter('rate_limit_hits'),
  
  fileUploadDuration: new Trend('file_upload_duration'),
  fileDownloadDuration: new Trend('file_download_duration'),
  catalogResponseTime: new Trend('catalog_response_time'),
  
  errorRate: new Rate('error_rate'),
  successRate: new Rate('success_rate'),
  
  activeUploads: new Gauge('active_uploads'),
  queueSize: new Gauge('queue_size')
};

export function recordFileUpload(duration: number, success: boolean): void {
  customMetrics.fileUploadDuration.add(duration);
  customMetrics.errorRate.add(!success);
  customMetrics.successRate.add(success);
  
  if (!success) {
    customMetrics.fileUploadErrors.add(1);
  }
}

export function recordFileDownload(duration: number, success: boolean): void {
  customMetrics.fileDownloadDuration.add(duration);
  customMetrics.errorRate.add(!success);
  customMetrics.successRate.add(success);
  
  if (!success) {
    customMetrics.fileDownloadErrors.add(1);
  }
}

export function recordCatalogOperation(duration: number, success: boolean): void {
  customMetrics.catalogResponseTime.add(duration);
  customMetrics.errorRate.add(!success);
  customMetrics.successRate.add(success);
  
  if (!success) {
    customMetrics.catalogErrors.add(1);
  }
}

export function recordRateLimit(): void {
  customMetrics.rateLimitHits.add(1);
}