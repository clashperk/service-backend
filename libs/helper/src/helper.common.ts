import moment from 'moment';
import { createCipheriv, createDecipheriv } from 'node:crypto';

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
