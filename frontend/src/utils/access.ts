import type { Role } from '../types'

/** Which roles may open each area of the application (also drives the sidebar). */
const ALL: Role[] = ['admin', 'geological_officer', 'management', 'viewer']
export const ACCESS: Record<string, Role[]> = {
  documents: ['admin', 'geological_officer', 'management'],
  validation: ['admin', 'geological_officer'],
  knowledge: ALL,
  ai: ['admin', 'geological_officer', 'management'],
  consistency: ['admin', 'geological_officer', 'management'],
  topics: ALL,
  reports: ALL,
  analytics: ALL,
  audit: ALL,
  settings: ALL,
}
