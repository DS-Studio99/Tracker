import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

export function formatDate(date: string | Date): string {
  if (!date) return 'Unknown Date';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid Date';
  return format(d, 'MMM d, yyyy');
}

export function formatTime(date: string | Date): string {
  if (!date) return 'Unknown Time';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid Time';
  return format(d, 'h:mm a');
}

export function formatDateTime(date: string | Date): string {
  if (!date) return 'Unknown Date & Time';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid Date & Time';
  return format(d, 'MMM d, yyyy h:mm a');
}

export function formatRelative(date: string | Date): string {
  if (!date) return 'Unknown Date';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid Date';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatDuration(seconds: number): string {
  if (seconds < 0 || isNaN(seconds)) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}h ${m}m`;
  } else if (m > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
}

export function formatPhoneNumber(number: string): string {
  if (!number) return 'Unknown number';
  let cleaned = ('' + number).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  }
  return number; 
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function truncate(str: string, length: number): string {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
