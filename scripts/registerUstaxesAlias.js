const Module = require('module')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function resolveWithUstaxesAlias(
  request,
  parent,
  isMain,
  options
) {
  if (typeof request === 'string' && request.startsWith('ustaxes/')) {
    const mappedRequest = path.join(
      projectRoot,
      'src',
      request.slice('ustaxes/'.length)
    )
    return originalResolveFilename.call(
      this,
      mappedRequest,
      parent,
      isMain,
      options
    )
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}
