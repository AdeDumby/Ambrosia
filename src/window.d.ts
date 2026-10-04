export {}

declare global {
  interface Window {
    api: {
      listCategories(): Promise<{ id: number; name: string; color: string; sortOrder: number }[]>
    }
  }
}