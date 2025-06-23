import { Logger } from '@nestjs/common';
import moment from 'moment';
import morgan from 'morgan';
import { createCipheriv, createDecipheriv } from 'node:crypto';

export const morganLogger = (logger: Logger) => {
  return morgan(
    (tokens, req, res) => {
      const status = res.statusCode;
      const color =
        status >= 500
          ? 31 // red
          : status >= 400
            ? 33 // yellow
            : status >= 300
              ? 36 // cyan
              : status >= 200
                ? 32 // green
                : 0; // no color

      return [
        `\x1b[0m${tokens.method?.(req, res)}`,
        `${tokens.url?.(req, res)} \x1b[` + color + `m${tokens.status?.(req, res)}\x1b[0m`,
        `${tokens['response-time']?.(req, res)} ms - ${tokens['remote-addr']?.(req, res)}\x1b[0m`,
        // @ts-expect-error why?
        req.user?.sub ?? '-',
      ].join(' ');
    },
    {
      stream: {
        write: (message: string) => logger.log(message.trim()),
      },
    },
  );
};

export const formatDate = (dateString: string) => {
  return moment(dateString).toDate();
};

export const getAppHealth = (service: string) => {
  const { rss, heapTotal, heapUsed } = process.memoryUsage();
  return {
    service,
    memoryUsage: {
      rss: `${(rss / 1024 / 1024).toFixed(2)} MB`, // Resident Set Size
      heapTotal: `${(heapTotal / 1024 / 1024).toFixed(2)} MB`, // Total Heap Size
      heapUsed: `${(heapUsed / 1024 / 1024).toFixed(2)} MB`, // Heap actually used
    },
  };
};

export const encrypt = async (value: string) => {
  const key = Buffer.from(process.env.CRYPTO_KEY!, 'hex');
  const iv = Buffer.from(process.env.CRYPTO_IV!, 'hex');
  const cipher = createCipheriv('aes256', key, iv);
  return Buffer.concat([cipher.update(value), cipher.final()]).toString('hex');
};

export const decrypt = async (value: string) => {
  const key = Buffer.from(process.env.CRYPTO_KEY!, 'hex');
  const iv = Buffer.from(process.env.CRYPTO_IV!, 'hex');
  const decipher = createDecipheriv('aes256', key, iv);
  return Buffer.concat([decipher.update(Buffer.from(value, 'hex')), decipher.final()]).toString();
};
