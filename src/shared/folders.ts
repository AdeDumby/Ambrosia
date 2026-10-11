export const PROTECTED_FOLDER = 'Franchise'
export const MAX_FOLDER_NAME = 40

export function isProtectedFolder(name: string): boolean {
  return name.trim().toLowerCase() === PROTECTED_FOLDER.toLowerCase()
}
