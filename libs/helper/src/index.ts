import moment from 'moment';

export * from './app-cluster.service';
export * from './helper.module';
export * from './helper.service';

export const formatDate = (dateString: string) => {
  return moment(dateString).toDate();
};
