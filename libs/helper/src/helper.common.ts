import moment from 'moment';

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
