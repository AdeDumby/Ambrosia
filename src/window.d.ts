export {}

declare global {
  interface Window {
    api: {
      listCategories(): Promise<{ id: number; name: string; color: string; sortOrder: number }[]>
      createCategory(name: string, color?: string): Promise<{ id: number; name: string; color: string; sortOrder: number }>
    }
  }
}