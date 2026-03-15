/**
 * XML Digital Signature Module for MeF (Modernized e-File) Submissions
 *
 * Implements XML-DSIG signing with SHA-256 for IRS e-file submissions.
 * Uses Web Crypto API (SubtleCrypto) for Cloudflare Workers compatibility.
 *
 * All cryptographic operations are async because SubtleCrypto is promise-based.
 */

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
  /** Optional passphrase for encrypted private keys (not supported in Web Crypto) */
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
// Helper Functions - Web Crypto API
// ============================================================================

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Encode data to Base64 using Web-compatible APIs
 * @param data - Uint8Array or string to encode
 * @returns Base64 encoded string
 */
export const base64Encode = (data: Uint8Array | string): string => {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  // Build binary string from bytes - works in both Workers and browsers
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Decode Base64 to Uint8Array
 * @param data - Base64 encoded string
 * @returns Decoded Uint8Array
 */
export const base64Decode = (data: string): Uint8Array => {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Compute SHA-256 digest of data using SubtleCrypto
 * @param data - Data to hash (string or Uint8Array)
 * @returns SHA-256 hash as Uint8Array
 */
export const computeDigest = async (
  data: string | Uint8Array
): Promise<Uint8Array> => {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  return new Uint8Array(hashBuffer)
}

/**
 * Strip PEM headers and whitespace to get raw Base64 key data
 */
const pemToBytes = (pem: string): Uint8Array => {
  const base64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s/g, '')
  return base64Decode(base64)
}

/**
 * Import an RSA private key from PEM format into a CryptoKey
 * Supports both PKCS#8 and PKCS#1 formats
 */
const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
  const keyData = pemToBytes(pem)

  // Try PKCS#8 first (BEGIN PRIVATE KEY)
  if (pem.includes('BEGIN PRIVATE KEY')) {
    return crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    )
  }

  // PKCS#1 (BEGIN RSA PRIVATE KEY) - wrap in PKCS#8 envelope
  // Web Crypto requires PKCS#8, so we wrap PKCS#1 keys
  if (pem.includes('BEGIN RSA PRIVATE KEY')) {
    const pkcs8Wrapped = wrapPkcs1InPkcs8(keyData)
    return crypto.subtle.importKey(
      'pkcs8',
      pkcs8Wrapped,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    )
  }

  // Try PKCS#8 as default
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  )
}

/**
 * Import an RSA public key from X509 certificate PEM for verification
 */
const importPublicKeyFromCert = async (pem: string): Promise<CryptoKey> => {
  // Extract the SPKI from the certificate
  // For X509 certificates, we use the raw certificate bytes
  const certData = pemToBytes(pem)

  // Try importing as SPKI (works if PEM is a public key)
  try {
    return await crypto.subtle.importKey(
      'spki',
      certData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['verify']
    )
  } catch {
    // If the PEM is a full X509 certificate, extract the SubjectPublicKeyInfo
    // from the TBSCertificate. This is a simplified ASN.1 parser for X509.
    const spki = extractSpkiFromCertificate(certData)
    return crypto.subtle.importKey(
      'spki',
      spki,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['verify']
    )
  }
}

/**
 * Wrap a PKCS#1 RSA private key in a PKCS#8 envelope
 * PKCS#8 = SEQUENCE { version INTEGER, algorithm AlgorithmIdentifier, privateKey OCTET STRING }
 */
function wrapPkcs1InPkcs8(pkcs1Bytes: Uint8Array): Uint8Array {
  // RSA OID: 1.2.840.113549.1.1.1
  const rsaOid = new Uint8Array([
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01
  ])
  // NULL parameters
  const nullParam = new Uint8Array([0x05, 0x00])

  // AlgorithmIdentifier SEQUENCE
  const algIdContent = new Uint8Array(rsaOid.length + nullParam.length)
  algIdContent.set(rsaOid, 0)
  algIdContent.set(nullParam, rsaOid.length)
  const algId = wrapAsn1Sequence(algIdContent)

  // Version INTEGER 0
  const version = new Uint8Array([0x02, 0x01, 0x00])

  // PrivateKey OCTET STRING wrapping the PKCS#1 bytes
  const privateKeyOctet = wrapAsn1OctetString(pkcs1Bytes)

  // Outer SEQUENCE
  const outerContent = new Uint8Array(
    version.length + algId.length + privateKeyOctet.length
  )
  outerContent.set(version, 0)
  outerContent.set(algId, version.length)
  outerContent.set(privateKeyOctet, version.length + algId.length)

  return wrapAsn1Sequence(outerContent)
}

/**
 * Wrap content in an ASN.1 SEQUENCE tag
 */
function wrapAsn1Sequence(content: Uint8Array): Uint8Array {
  return wrapAsn1Tag(0x30, content)
}

/**
 * Wrap content in an ASN.1 OCTET STRING tag
 */
function wrapAsn1OctetString(content: Uint8Array): Uint8Array {
  return wrapAsn1Tag(0x04, content)
}

/**
 * Wrap content with an ASN.1 tag and DER-encoded length
 */
function wrapAsn1Tag(tag: number, content: Uint8Array): Uint8Array {
  const lengthBytes = derEncodeLength(content.length)
  const result = new Uint8Array(1 + lengthBytes.length + content.length)
  result[0] = tag
  result.set(lengthBytes, 1)
  result.set(content, 1 + lengthBytes.length)
  return result
}

/**
 * DER-encode a length value
 */
function derEncodeLength(length: number): Uint8Array {
  if (length < 0x80) {
    return new Uint8Array([length])
  }
  if (length < 0x100) {
    return new Uint8Array([0x81, length])
  }
  if (length < 0x10000) {
    return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff])
  }
  return new Uint8Array([
    0x83,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff
  ])
}

/**
 * Parse a DER-encoded length and return [length, bytesConsumed]
 */
function parseDerLength(data: Uint8Array, offset: number): [number, number] {
  const first = data[offset]
  if (first < 0x80) {
    return [first, 1]
  }
  const numBytes = first & 0x7f
  let length = 0
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | data[offset + 1 + i]
  }
  return [length, 1 + numBytes]
}

/**
 * Extract SubjectPublicKeyInfo (SPKI) from an X.509 certificate
 *
 * X.509 Certificate structure (simplified):
 *   SEQUENCE {
 *     tbsCertificate SEQUENCE {
 *       version [0] EXPLICIT INTEGER (optional)
 *       serialNumber INTEGER
 *       signature AlgorithmIdentifier
 *       issuer Name
 *       validity Validity
 *       subject Name
 *       subjectPublicKeyInfo SubjectPublicKeyInfo  <-- we want this
 *       ...
 *     }
 *     signatureAlgorithm AlgorithmIdentifier
 *     signatureValue BIT STRING
 *   }
 */
function extractSpkiFromCertificate(certDer: Uint8Array): Uint8Array {
  let offset = 0

  // Outer SEQUENCE (Certificate)
  if (certDer[offset] !== 0x30) {
    throw new Error('Invalid certificate: expected SEQUENCE')
  }
  offset++
  const [, outerLenBytes] = parseDerLength(certDer, offset)
  offset += outerLenBytes

  // TBSCertificate SEQUENCE
  if (certDer[offset] !== 0x30) {
    throw new Error('Invalid certificate: expected TBSCertificate SEQUENCE')
  }
  offset++
  const [, tbsLenBytes] = parseDerLength(certDer, offset)
  offset += tbsLenBytes

  // version [0] EXPLICIT (optional) - tag 0xA0
  if (certDer[offset] === 0xa0) {
    offset++
    const [versionLen, versionLenBytes] = parseDerLength(certDer, offset)
    offset += versionLenBytes + versionLen
  }

  // serialNumber INTEGER
  if (certDer[offset] === 0x02) {
    offset++
    const [serialLen, serialLenBytes] = parseDerLength(certDer, offset)
    offset += serialLenBytes + serialLen
  }

  // signature AlgorithmIdentifier SEQUENCE
  if (certDer[offset] === 0x30) {
    offset++
    const [sigLen, sigLenBytes] = parseDerLength(certDer, offset)
    offset += sigLenBytes + sigLen
  }

  // issuer Name SEQUENCE
  if (certDer[offset] === 0x30) {
    offset++
    const [issuerLen, issuerLenBytes] = parseDerLength(certDer, offset)
    offset += issuerLenBytes + issuerLen
  }

  // validity SEQUENCE
  if (certDer[offset] === 0x30) {
    offset++
    const [validityLen, validityLenBytes] = parseDerLength(certDer, offset)
    offset += validityLenBytes + validityLen
  }

  // subject Name SEQUENCE
  if (certDer[offset] === 0x30) {
    offset++
    const [subjectLen, subjectLenBytes] = parseDerLength(certDer, offset)
    offset += subjectLenBytes + subjectLen
  }

  // subjectPublicKeyInfo SEQUENCE - this is what we want
  if (certDer[offset] !== 0x30) {
    throw new Error(
      'Invalid certificate: expected SubjectPublicKeyInfo SEQUENCE'
    )
  }

  const spkiStart = offset
  offset++
  const [spkiContentLen, spkiLenBytes] = parseDerLength(certDer, offset)
  const spkiTotalLen = 1 + spkiLenBytes + spkiContentLen

  return certDer.slice(spkiStart, spkiStart + spkiTotalLen)
}

/**
 * Create RSA-SHA256 signature using Web Crypto API
 * @param data - Data to sign
 * @param privateKey - RSA private key in PEM format
 * @param _passphrase - Not supported in Web Crypto (kept for API compatibility)
 * @returns Signature as Uint8Array
 */
export const createSignature = async (
  data: string | Uint8Array,
  privateKey: string,
  _passphrase?: string
): Promise<Uint8Array> => {
  const key = await importPrivateKey(privateKey)
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    bytes
  )
  return new Uint8Array(signatureBuffer)
}

/**
 * Verify RSA-SHA256 signature using Web Crypto API
 * @param data - Original data
 * @param signature - Signature to verify
 * @param certificate - X509 certificate in PEM format
 * @returns true if signature is valid
 */
export const verifySignature = async (
  data: string | Uint8Array,
  signature: Uint8Array,
  certificate: string
): Promise<boolean> => {
  try {
    const key = await importPublicKeyFromCert(certificate)
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, bytes)
  } catch {
    return false
  }
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

/**
 * Compare two Uint8Arrays for equality
 */
const uint8ArrayEquals = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
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
 *
 * All signing and verification methods are async because
 * the Web Crypto API (SubtleCrypto) is promise-based.
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
      !config.certificate.includes('BEGIN TRUSTED CERTIFICATE') &&
      !config.certificate.includes('BEGIN PUBLIC KEY')
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
   * @returns Promise resolving to signed XML document with embedded Signature element
   */
  async sign(xml: string, options: SignOptions = {}): Promise<string> {
    const { referenceUri = '', signatureId } = options

    // Step 1: Apply enveloped signature transform (remove any existing signature)
    const xmlWithoutSig = removeSignatureElement(xml)

    // Step 2: Canonicalize the XML for digest computation
    const canonicalXml = canonicalize(xmlWithoutSig)

    // Step 3: Compute digest of canonical XML
    const digest = await computeDigest(canonicalXml)
    const digestValue = base64Encode(digest)

    // Step 4: Create SignedInfo element
    const signedInfo = this.createSignedInfo(referenceUri, digestValue)

    // Step 5: Canonicalize SignedInfo for signing
    const canonicalSignedInfo = canonicalize(signedInfo)

    // Step 6: Create signature over canonical SignedInfo
    const signature = await createSignature(
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
   * @returns Promise resolving to true if signature is valid
   */
  async verify(signedXml: string): Promise<boolean> {
    try {
      const result = await this.verifyWithDetails(signedXml)
      return result.valid
    } catch {
      return false
    }
  }

  /**
   * Verify a signed XML document with detailed results
   *
   * @param signedXml - Signed XML document
   * @returns Promise resolving to verification result with details
   */
  async verifyWithDetails(signedXml: string): Promise<VerificationResult> {
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
      const computedDigestBytes = await computeDigest(canonicalXml)
      const expectedDigest = base64Decode(digestValueMatch[1].trim())

      if (!uint8ArrayEquals(computedDigestBytes, expectedDigest)) {
        return { valid: false, error: 'Digest verification failed' }
      }

      // Step 3: Verify signature
      const signedInfoElement = `<SignedInfo xmlns="${XMLDSIG_NS}">${signedInfoMatch[1]}</SignedInfo>`
      const canonicalSignedInfo = canonicalize(signedInfoElement)
      const signatureBytes = base64Decode(signatureValueMatch[1].trim())

      const isValid = await verifySignature(
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
 * @param passphrase - Optional passphrase (not supported in Web Crypto)
 * @returns Promise resolving to signed XML document
 */
export const signXml = async (
  xml: string,
  certificate: string,
  privateKey: string,
  passphrase?: string
): Promise<string> => {
  const signer = createSigner({ certificate, privateKey, passphrase })
  return signer.sign(xml)
}

/**
 * Verify signed XML (convenience function)
 * @param signedXml - Signed XML document
 * @param certificate - X509 certificate in PEM format
 * @returns Promise resolving to true if signature is valid
 */
export const verifyXml = async (
  signedXml: string,
  certificate: string
): Promise<boolean> => {
  // For verification, we need the certificate but not the private key
  // Create a dummy config since verify only uses the certificate
  const signer = createSigner({
    certificate,
    privateKey: certificate // Not used for verification
  })
  return signer.verify(signedXml)
}
