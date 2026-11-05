import { MAX_SCHEDULE_HOURS } from '../../../config/constants';
import { Errors } from '../../../shared/kernel/errors';

export function assertScheduleWindow(start: Date, end: Date): void {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw Errors.validation('Schedule timestamps are invalid');
  }
  if (end.getTime() <= start.getTime()) {
    throw Errors.validation('scheduledEnd must be after scheduledStart');
  }
  const hours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
  if (hours > MAX_SCHEDULE_HOURS) {
    throw Errors.validation(`A schedule window cannot exceed ${MAX_SCHEDULE_HOURS} hours`);
  }
}

export function windowsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}
