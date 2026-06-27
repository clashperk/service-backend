import { Util as CocUtil } from 'clashofclans.js';
import moment from 'moment';

export class Util extends CocUtil {
  public static raidWeek() {
    const start = moment();
    const day = start.day();
    const hours = start.hours();
    const isRaidWeek =
      (day === 5 && hours >= 7) || [0, 6].includes(day) || (day === 1 && hours < 7);
    if (day < 5 || (day <= 5 && hours < 7)) start.day(-7);
    start.day(5);
    start.hours(7).minutes(0).seconds(0).milliseconds(0);

    return {
      startTime: start.toDate(),
      weekId: start.format('YYYY-MM-DD'),
      prevWeekEndTime: start.clone().subtract(4, 'days').toDate(),
      endTime: start.clone().add(3, 'days').toDate(),
      isRaidWeek,
    };
  }
}
