import type { Context } from 'hono'

import type { Env } from '../domain/env'
import { HttpError } from './http'

export const assertInternalAuth = (c: Context<{ Bindings: Env }>): void => {
  const configured = c.env.INTERNAL_API_TOKEN
  if (!configured) {
    return
  }

  const presented = c.req.header('x-internal-token')
  if (!presented || presented !== configured) {
    throw new HttpError(401, 'Unauthorized internal API request')
  }
}
