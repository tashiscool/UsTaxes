export interface ArtifactStore {
  putJson<T>(key: string, payload: T): Promise<void>
  getJson<T>(key: string): Promise<T | null>
}
