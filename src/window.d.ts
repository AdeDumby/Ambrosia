export {}

declare global {
  interface Window {
    api: {
      listCategories(): Promise<{ id: number; name: string; color: string; sortOrder: number }[]>
      createCategory(
        name: string,
        color?: string
      ): Promise<{ id: number; name: string; color: string; sortOrder: number }>
      listTags(): Promise<{ id: number; name: string; categoryId: number | null }[]>
      createTag(
        name: string,
        categoryId: number | null
      ): Promise<{ id: number; name: string; categoryId: number | null }>
    }
  }
}
