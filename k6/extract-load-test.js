import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Latensi ekstraksi ujung-ke-ujung: dari submit sampai job COMPLETED/FAILED.
// BUKAN cuma latensi POST /extract -- itu sekarang selalu cepat (202
// seketika, Tahap 2) dan akan menyesatkan kalau dilaporkan sebagai
// "kecepatan ekstraksi".
const extractionDuration = new Trend('extraction_duration_ms', true);
const extractionFailures = new Counter('extraction_failures');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// Tiga file berbeda, bukan satu -- kalau sama, idempotency (Tahap 3)
// bikin iterasi ke-2/3 kena dedup dan balik hasil job lama SEKETIKA,
// nyamarin latensi ekstraksi asli jadi kelihatan super cepat (dites,
// kejadian beneran: iterasi ke-2/3 selesai dalam 14ms tanpa file beda ini).
const SAMPLE_FILES = [
  open('../public/samples/sample-1.jpg', 'b'),
  open('../public/samples/sample-2.jpg', 'b'),
  open('../public/samples/sample-3.jpg', 'b'),
];

export const options = {
  // SENGAJA kecil. Gemini free tier cuma ~5 request/menit dan ~20/hari
  // (lihat docs/notes/tahap-0-hasil.md) -- ini demonstrasi CARA load
  // test, bukan stress test sungguhan. Jangan naikkan vus/iterations
  // tanpa upgrade tier model dulu.
  vus: 1,
  iterations: 3,
};

export default function () {
  const sampleFile = SAMPLE_FILES[__ITER % SAMPLE_FILES.length];
  const formData = { file: http.file(sampleFile, `sample-${__ITER}.jpg`, 'image/jpeg') };
  const submitRes = http.post(`${BASE_URL}/extract`, formData);

  const submitted = check(submitRes, { 'submit diterima (202)': (r) => r.status === 202 });
  if (!submitted) {
    extractionFailures.add(1);
    return;
  }

  const jobId = submitRes.json('jobId');
  const startedAt = Date.now();
  const deadline = startedAt + 60_000;

  let job;
  while (Date.now() < deadline) {
    const pollRes = http.get(`${BASE_URL}/jobs/${jobId}`);
    job = pollRes.json();
    if (job.status === 'COMPLETED' || job.status === 'FAILED') break;
    sleep(1);
  }

  extractionDuration.add(Date.now() - startedAt);

  const completed = check(job, { 'job selesai (COMPLETED)': (j) => j && j.status === 'COMPLETED' });
  if (!completed) extractionFailures.add(1);

  sleep(13); // jeda antar iterasi -- tetap di bawah rate limit Gemini
}
