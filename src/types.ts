import { Timestamp } from 'firebase/firestore';

export enum PresenceType {
  IN = 'IN',
  OUT = 'OUT'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SECURITY = 'SECURITY',
  EMPLOYEE = 'EMPLOYEE'
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  nik: string;
  isVisitor?: boolean;
  createdAt?: any;
}

export interface PresenceLog {
  id?: string;
  employeeId: string;
  timestamp: Timestamp | any;
  type: PresenceType;
  date: string; // YYYY-MM-DD
}

export interface DailyStats {
  in: number;
  out: number;
  pob: number;
  totalVisits: number;
  visitorIn?: number;
  visitorOut?: number;
}
