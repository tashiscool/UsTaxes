/**
 * XML Digital Signature Module for MeF (Modernized e-File) Submissions
 *
 * Implements XML-DSIG signing with SHA-256 for IRS e-file submissions.
 * Uses Node.js crypto module (compatible with browser polyfills).
 */

import * as crypto from 'crypto'

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for the XML signer
 */
export interface SignerConfig {
  /** X509 certificate in PEM format */
  certificate: string
  /** RSA private key in PEM format */
  privateKey: string
  /** Optional passphrase for encrypted private keys */
  passphrase?: string
}

/**
 * Options for signing operations
 */
export interface SignOptions {
  /** URI reference for the signed content (default: "" for entire document) */
  referenceUri?: string
  /** ID attribute for the Signature element */
  signatureId?: string
  /** Additional transforms to apply before digest */
  additionalTransforms?: string[]
}

/**
 * Result of signature verification
 */
export interface VerificationResult {
  /** Whether the signature is valid */
  valid: boolean
  /** Error message if verification failed */
  error?: string
}

// ============================================================================
// XML-DSIG Constants
// ============================================================================

const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#'
const XMLDSIG_MORE_NS = 'http://www.w3.org/2001/04/xmldsig-more#'
const XMLENC_NS = 'http://www.w3.org/2001/04/xmlenc#'

const ALGORITHMS = {
  CANONICALIZATION: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  SIGNATURE_RSA_SHA256: `${XMLDSIG_MORE_NS}rsa-sha256`,
  DIGEST_SHA256: `${XMLENC_NS}sha256`,
  TRANSFORM_ENVELOPED: `${XMLDSIG_NS}enveloped-signature`
} as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Encode data to Base64
 * @param data - Buffer or string to encode
 * @returns Base64 encoded string
 */
export const base64Encode = (data: Buffer | string): string => {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data
  return buffer.toString('base64')
}

/**
 * Decode Base64 to Buffer
 * @param data - Base64 encoded string
 * @returns Decoded Buffer
 */
export const base64Decode = (data: string): Buffer => {
  return Buffer.from(data, 'base64')
}

/**
 * Compute SHA-256 digest of data
 * @param data - Data to hash
 * @returns SHA-256 hash as Buffer
 */
export const computeDigest = (data: string | Buffer): Buffer => {
  const hash = crypto.createHash('sha256')
  hash.update(data)
  return hash.digest()
}

/**
 * Create RSA-SHA256 signature
 * @param data - Data to sign
 * @param privateKey - RSA private key in PEM format
 * @param passphrase - Optional passphrase for encrypted keys
 * @returns Signature as Buffer
 */
export const createSignature = (
  data: string | Buffer,
  privateKey: string,
  passphrase?: string
): Buffer => {
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(data)
  sign.end()

  const keyOptions: crypto.SignPrivateKeyInput = {
    key: privateKey,
    passphrase: passphrase
  }

  return sign.sign(keyOptions)
}

/**
 * Verify RSA-SHA256 signature
 * @param data - Original data
 * @param signature - Signature to verify
 * @param certificate - X509 certificate in PEM format
 * @returns true if signature is valid
 */
export const verifySignature = (
  data: string | Buffer,
  signature: Buffer,
  certificate: string
): boolean => {
  const verify = crypto.createVerify('RSA-SHA256')
  verify.update(data)
  verify.end()
  return verify.verify(certificate, signature)
}

/**
 * Canonicalize XML (C14N - Canonical XML 1.0)
 *
 * This is a simplified implementation that handles the core C14N requirements:
 * - Normalize line endings to LF
 * - Normalize attribute values
 * - Sort attributes by namespace URI then local name
 * - Expand empty elements
 * - Normalize whitespace in attribute values
 *
 * For production use, consider using a full C14N library.
 *
 * @param xml - XML string to canonicalize
 * @returns Canonicalized XML string
 */
export const canonicalize = (xml: string): string => {
  // Step 1: Normalize line endings to LF
  let result = xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Step 2: Remove XML declaration (C14N does not include it)
  result = result.replace(/<\?xml[^?]*\?>\s*/gi, '')

  // Step 3: Remove leading/trailing whitespace from document
  result = result.trim()

  // Step 4: Normalize whitespace in text nodes (preserve significant whitespace)
  // This is a simplified approach - full C14N has more complex rules

  // Step 5: Expand empty elements: <element/> -> <element></element>
  result = result.replace(
    /<([a-zA-Z][a-zA-Z0-9_:-]*)([^>]*?)\/>/g,
    '<$1$2></$1>'
  )

  // Step 6: Sort attributes and normalize namespace declarations
  result = normalizeAttributes(result)

  // Step 7: Normalize attribute values (replace special chars)
  result = normalizeAttributeValues(result)

  return result
}

/**
 * Normalize and sort attributes in XML elements
 * @param xml - XML string
 * @returns XML with normalized attributes
 */
const normalizeAttributes = (xml: string): string => {
  // Match elements with attributes
  const elementRegex = /<([a-zA-Z][a-zA-Z0-9_:-]*)(\s+[^>]*)?>/g

  return xml.replace(
    elementRegex,
    (match, tagName: string, attrStr: string) => {
      if (!attrStr || attrStr.trim() === '') {
        return `<${tagName}>`
      }

      // Parse attributes
      const attrRegex =
        /([a-zA-Z][a-zA-Z0-9_:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
      const attrs: Array<{ name: string; value: string }> = []
      let attrMatch: RegExpExecArray | null

      while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
        // attrMatch[2] is double-quoted value, attrMatch[3] is single-quoted value
        // One of these will be undefined depending on which quote style was used
        const doubleQuoted = attrMatch[2] as string | undefined
        const singleQuoted = attrMatch[3] as string | undefined
        attrs.push({
          name: attrMatch[1],
          value: doubleQuoted ?? singleQuoted ?? ''
        })
      }

      // Sort attributes: xmlns declarations first, then by namespace URI, then by local name
      attrs.sort((a, b) => {
        const aIsXmlns = a.name.startsWith('xmlns')
        const bIsXmlns = b.name.startsWith('xmlns')

        // xmlns declarations come first
        if (aIsXmlns && !bIsXmlns) return -1
        if (!aIsXmlns && bIsXmlns) return 1

        // Sort xmlns:prefix before xmlns
        if (aIsXmlns && bIsXmlns) {
          if (a.name === 'xmlns' && b.name !== 'xmlns') return -1
          if (a.name !== 'xmlns' && b.name === 'xmlns') return 1
        }

        // Alphabetical sort for remaining attributes
        return a.name.localeCompare(b.name)
      })

      // Rebuild attribute string
      const sortedAttrs = attrs.map((a) => `${a.name}="${a.value}"`).join(' ')
      return `<${tagName} ${sortedAttrs}>`
    }
  )
}

/**
 * Normalize attribute values according to C14N spec
 * @param xml - XML string
 * @returns XML with normalized attribute values
 */
const normalizeAttributeValues = (xml: string): string => {
  // In attribute values:
  // - & -> &amp;
  // - < -> &lt;
  // - " -> &quot;
  // - &#xD; -> &#xD; (preserve)
  // - &#xA; -> &#xA; (preserve)
  // - &#x9; -> &#x9; (preserve)

  // This is handled during attribute parsing/rebuilding
  // For now, ensure consistent quote style (double quotes)
  return xml.replace(/([a-zA-Z][a-zA-Z0-9_:-]*)\s*=\s*'([^']*)'/g, '$1="$2"')
}

/**
 * Extract certificate data from PEM format
 * @param pem - PEM formatted certificate
 * @returns Base64 encoded certificate data (without headers)
 */
export const extractCertificateData = (pem: string): string => {
  const lines = pem.split('\n')
  const certLines = lines.filter(
    (line) =>
      !line.startsWith('-----BEGIN') &&
      !line.startsWith('-----END') &&
      line.trim() !== ''
  )
  return certLines.join('')
}

/**
 * Remove the Signature element from XML for digest computation
 * @param xml - Signed XML string
 * @returns XML without Signature element
 */
const removeSignatureElement = (xml: string): string => {
  // Remove Signature element and any surrounding whitespace
  return xml.replace(
    /<(?:[a-zA-Z0-9_-]+:)?Signature[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#"[^>]*>[\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?Signature>/g,
    ''
  )
}

// ============================================================================
// XmlSigner Class
// ============================================================================

/**
 * XML Digital Signature signer for MeF submissions
 *
 * Implements XML-DSIG with:
 * - RSA-SHA256 signature algorithm
 * - SHA-256 digest algorithm
 * - Enveloped signature transform
 * - Canonical XML (C14N) canonicalization
 */
export class XmlSigner {
  private config: SignerConfig

  /**
   * Create a new XmlSigner instance
   * @param config - Signer configuration with certificate and private key
   */
  constructor(config: SignerConfig) {
    this.validateConfig(config)
    this.config = config
  }

  /**
   * Validate signer configuration
   * @param config - Configuration to validate
   */
  private validateConfig(config: SignerConfig): void {
    if (!config.certificate) {
      throw new Error('Certificate is required')
    }
    if (!config.privateKey) {
      throw new Error('Private key is required')
    }
    if (
      !config.certificate.includes('BEGIN CERTIFICATE') &&
      !config.certificate.includes('BEGIN TRUSTED CERTIFICATE')
    ) {
      throw new Error('Certificate must be in PEM format')
    }
    if (
      !config.privateKey.includes('BEGIN') ||
      !config.privateKey.includes('KEY')
    ) {
      throw new Error('Private key must be in PEM format')
    }
  }

  /**
   * Sign an XML document with an enveloped signature
   *
   * @param xml - XML document to sign
   * @param options - Optional signing options
   * @returns Signed XML document with embedded Signature element
   */
  sign(xml: string, options: SignOptions = {}): string {
    const { referenceUri = '', signatureId } = options

    // Step 1: Apply enveloped signature transform (remove any existing signature)
    const xmlWithoutSig = removeSignatureElement(xml)

    // Step 2: Canonicalize the XML for digest computation
    const canonicalXml = canonicalize(xmlWithoutSig)

    // Step 3: Compute digest of canonical XML
    const digest = computeDigest(canonicalXml)
    const digestValue = base64Encode(digest)

    // Step 4: Create SignedInfo element
    const signedInfo = this.createSignedInfo(referenceUri, digestValue)

    // Step 5: Canonicalize SignedInfo for signing
    const canonicalSignedInfo = canonicalize(signedInfo)

    // Step 6: Create signature over canonical SignedInfo
    const signature = createSignature(
      canonicalSignedInfo,
      this.config.privateKey,
      this.config.passphrase
    )
    const signatureValue = base64Encode(signature)

    // Step 7: Create KeyInfo element with certificate
    const keyInfo = this.createKeyInfo()

    // Step 8: Build complete Signature element
    const signatureElement = this.createSignatureElement(
      signedInfo,
      signatureValue,
      keyInfo,
      signatureId
    )

    // Step 9: Insert signature into document
    return this.insertSignature(xml, signatureElement)
  }

  /**
   * Verify a signed XML document
   *
   * @param signedXml - Signed XML document
   * @returns true if signature is valid
   */
  verify(signedXml: string): boolean {
    try {
      const result = this.verifyWithDetails(signedXml)
      return result.valid
    } catch {
      return false
    }
  }

  /**
   * Verify a signed XML document with detailed results
   *
   * @param signedXml - Signed XML document
   * @returns Verification result with details
   */
  verifyWithDetails(signedXml: string): VerificationResult {
    try {
      // Step 1: Extract SignedInfo, SignatureValue, and DigestValue
      const signedInfoMatch = signedXml.match(
        /<SignedInfo[^>]*>([\s\S]*?)<\/SignedInfo>/
      )
      if (!signedInfoMatch) {
        return { valid: false, error: 'SignedInfo element not found' }
      }

      const signatureValueMatch = signedXml.match(
        /<SignatureValue[^>]*>([\s\S]*?)<\/SignatureValue>/
      )
      if (!signatureValueMatch) {
        return { valid: false, error: 'SignatureValue element not found' }
      }

      const digestValueMatch = signedXml.match(
        /<DigestValue[^>]*>([\s\S]*?)<\/DigestValue>/
      )
      if (!digestValueMatch) {
        return { valid: false, error: 'DigestValue element not found' }
      }

      // Step 2: Verify digest
      const xmlWithoutSig = removeSignatureElement(signedXml)
      const canonicalXml = canonicalize(xmlWithoutSig)
      const computedDigest = computeDigest(canonicalXml)
      const expectedDigest = base64Decode(digestValueMatch[1].trim())

      if (!computedDigest.equals(expectedDigest)) {
        return { valid: false, error: 'Digest verification failed' }
      }

      // Step 3: Verify signature
      const signedInfoElement = `<SignedInfo xmlns="${XMLDSIG_NS}">${signedInfoMatch[1]}</SignedInfo>`
      const canonicalSignedInfo = canonicalize(signedInfoElement)
      const signatureBytes = base64Decode(signatureValueMatch[1].trim())

      const isValid = verifySignature(
        canonicalSignedInfo,
        signatureBytes,
        this.config.certificate
      )

      if (!isValid) {
        return { valid: false, error: 'Signature verification failed' }
      }

      return { valid: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { valid: false, error: `Verification error: ${message}` }
    }
  }

  /**
   * Create SignedInfo element
   */
  private createSignedInfo(referenceUri: string, digestValue: string): string {
    return `<SignedInfo xmlns="${XMLDSIG_NS}">
<CanonicalizationMethod Algorithm="${ALGORITHMS.CANONICALIZATION}"/>
<SignatureMethod Algorithm="${ALGORITHMS.SIGNATURE_RSA_SHA256}"/>
<Reference URI="${referenceUri}">
<Transforms>
<Transform Algorithm="${ALGORITHMS.TRANSFORM_ENVELOPED}"/>
</Transforms>
<DigestMethod Algorithm="${ALGORITHMS.DIGEST_SHA256}"/>
<DigestValue>${digestValue}</DigestValue>
</Reference>
</SignedInfo>`
  }

  /**
   * Create KeyInfo element with X509 certificate
   */
  private createKeyInfo(): string {
    const certData = extractCertificateData(this.config.certificate)
    return `<KeyInfo xmlns="${XMLDSIG_NS}">
<X509Data>
<X509Certificate>${certData}</X509Certificate>
</X509Data>
</KeyInfo>`
  }

  /**
   * Create complete Signature element
   */
  private createSignatureElement(
    signedInfo: string,
    signatureValue: string,
    keyInfo: string,
    signatureId?: string
  ): string {
    const idAttr = signatureId ? ` Id="${signatureId}"` : ''
    return `<Signature xmlns="${XMLDSIG_NS}"${idAttr}>
${signedInfo}
<SignatureValue>${signatureValue}</SignatureValue>
${keyInfo}
</Signature>`
  }

  /**
   * Insert signature element into XML document
   *
   * Places signature before the closing tag of the root element
   */
  private insertSignature(xml: string, signatureElement: string): string {
    // Find the root element's closing tag
    const rootCloseMatch = xml.match(/<\/([a-zA-Z][a-zA-Z0-9_:-]*)>\s*$/)

    if (!rootCloseMatch) {
      throw new Error('Could not find root element closing tag')
    }

    const rootClosingTag = rootCloseMatch[0]
    const insertPosition = xml.lastIndexOf(rootClosingTag)

    // Insert signature before closing tag
    return (
      xml.slice(0, insertPosition) +
      signatureElement +
      '\n' +
      xml.slice(insertPosition)
    )
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an XmlSigner instance
 * @param config - Signer configuration
 * @returns XmlSigner instance
 */
export const createSigner = (config: SignerConfig): XmlSigner => {
  return new XmlSigner(config)
}

/**
 * Sign XML with provided credentials (convenience function)
 * @param xml - XML document to sign
 * @param certificate - X509 certificate in PEM format
 * @param privateKey - RSA private key in PEM format
 * @param passphrase - Optional passphrase for encrypted keys
 * @returns Signed XML document
 */
export const signXml = (
  xml: string,
  certificate: string,
  privateKey: string,
  passphrase?: string
): string => {
  const signer = createSigner({ certificate, privateKey, passphrase })
  return signer.sign(xml)
}

/**
 * Verify signed XML (convenience function)
 * @param signedXml - Signed XML document
 * @param certificate - X509 certificate in PEM format
 * @returns true if signature is valid
 */
export const verifyXml = (signedXml: string, certificate: string): boolean => {
  // For verification, we need the certificate but not the private key
  // Create a dummy config since verify only uses the certificate
  const signer = createSigner({
    certificate,
    privateKey: certificate // Not used for verification
  })
  return signer.verify(signedXml)
}
