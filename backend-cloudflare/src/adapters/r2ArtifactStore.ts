import type { ArtifactStore } from './artifactStore'

export class R2ArtifactStore implements ArtifactStore {
  constructor(private readonly bucket: R2Bucket) {}

  async putJson<T>(key: string, payload: T): Promise<void> {
    await this.bucket.put(key, JSON.stringify(payload), {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8'
      }
    })
  }

  async getJson<T>(key: string): Promise<T | null> {
    const object = await this.bucket.get(key)
    if (!object) {
      return null
    }

    const text = await object.text()
    return JSON.parse(text) as T
  }
}
