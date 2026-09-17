import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

export type SyntheticScenario =
  | 'HAPPY_PATH'
  | 'NO_SLOT'
  | 'CAPACITY_MISMATCH'
  | 'CAPTCHA'
  | 'OTP'
  | 'SLOT_LOST';

export class SyntheticVfsServer {
  private server?: http.Server;
  private port?: number;
  private scenario: SyntheticScenario = 'HAPPY_PATH';
  public humanChallengeCleared = false;
  public paymentCompleted = false;

  setScenario(scenario: SyntheticScenario) {
    this.scenario = scenario;
    this.humanChallengeCleared = false;
    this.paymentCompleted = false;
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as any;
        this.port = addr.port;
        resolve(`http://127.0.0.1:${this.port}`);
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    }
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${this.port}`);
    const pathname = url.pathname;

    const serveFixture = (filename: string, statusCode = 200) => {
      const filePath = path.join(FIXTURES_DIR, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(statusCode, { 'Content-Type': 'text/html' });
      res.end(content);
    };

    if (pathname === '/' || pathname === '/login') {
      if (req.method === 'POST') {
        if (this.scenario === 'CAPTCHA' && !this.humanChallengeCleared) {
          res.writeHead(302, { Location: '/captcha' });
          res.end();
          return;
        }
        if (this.scenario === 'OTP' && !this.humanChallengeCleared) {
          res.writeHead(302, { Location: '/otp' });
          res.end();
          return;
        }
        res.writeHead(302, { Location: '/dashboard' });
        res.end();
        return;
      }

      if (this.scenario === 'CAPTCHA' && !this.humanChallengeCleared) {
        serveFixture('captcha.html');
        return;
      }

      serveFixture('login.html');
      return;
    }

    if (pathname === '/captcha') {
      if (this.humanChallengeCleared) {
        res.writeHead(302, { Location: '/dashboard' });
        res.end();
        return;
      }
      serveFixture('captcha.html');
      return;
    }

    if (pathname === '/otp') {
      if (this.humanChallengeCleared) {
        res.writeHead(302, { Location: '/dashboard' });
        res.end();
        return;
      }
      serveFixture('otp.html');
      return;
    }


    if (pathname === '/dashboard') {
      serveFixture('booking-home.html');
      return;
    }

    if (pathname === '/appointment-details') {
      if (req.method === 'POST') {
        res.writeHead(302, { Location: '/applicants' });
        res.end();
        return;
      }
      serveFixture('appointment-details.html');
      return;
    }

    if (pathname === '/applicants') {
      if (req.method === 'POST') {
        res.writeHead(302, { Location: '/slot-selection' });
        res.end();
        return;
      }
      if (this.scenario === 'NO_SLOT') {
        serveFixture('availability-no-slot.html');
        return;
      }
      serveFixture('applicant-details.html');
      return;
    }

    if (pathname === '/slot-selection') {
      if (req.method === 'POST') {
        res.writeHead(302, { Location: '/payment' });
        res.end();
        return;
      }
      if (this.scenario === 'NO_SLOT') {
        serveFixture('availability-no-slot.html');
        return;
      }
      serveFixture('availability-capacity.html');
      return;
    }

    if (pathname === '/payment') {
      if (req.method === 'POST' || this.paymentCompleted) {
        res.writeHead(302, { Location: '/confirmation' });
        res.end();
        return;
      }
      serveFixture('payment.html');
      return;
    }

    if (pathname === '/confirmation') {
      serveFixture('confirmation.html');
      return;
    }

    // Default fallback
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}
