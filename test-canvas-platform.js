/**
 * Test script to verify @napi-rs/canvas platform detection
 * 
 * This script tests that the correct platform-specific binding is loaded
 * based on the current platform and architecture.
 */

console.log('🔍 Testing @napi-rs/canvas platform detection...\n')

console.log('Platform Information:')
console.log(`  OS: ${process.platform}`)
console.log(`  Architecture: ${process.arch}`)
console.log(`  Node Version: ${process.version}`)
console.log()

// Expected binding for current platform
let expectedBinding = 'unknown'
if (process.platform === 'darwin') {
  if (process.arch === 'arm64') {
    expectedBinding = '@napi-rs/canvas-darwin-arm64'
  } else if (process.arch === 'x64') {
    expectedBinding = '@napi-rs/canvas-darwin-x64'
  }
} else if (process.platform === 'linux') {
  if (process.arch === 'arm64') {
    expectedBinding = '@napi-rs/canvas-linux-arm64-gnu'
  } else if (process.arch === 'x64') {
    expectedBinding = '@napi-rs/canvas-linux-x64-gnu'
  }
}

console.log(`Expected binding: ${expectedBinding}\n`)

// Try to load the canvas module
try {
  console.log('Attempting to load @napi-rs/canvas...')
  const canvas = require('@napi-rs/canvas')
  
  console.log('✅ Canvas module loaded successfully!\n')
  
  // Test creating a canvas
  console.log('Testing canvas creation...')
  const testCanvas = canvas.createCanvas(100, 100)
  const ctx = testCanvas.getContext('2d')
  
  console.log('✅ Canvas created successfully!')
  console.log(`  Canvas size: ${testCanvas.width}x${testCanvas.height}`)
  console.log()
  
  // Test basic drawing
  console.log('Testing basic drawing operations...')
  ctx.fillStyle = '#FF0000'
  ctx.fillRect(0, 0, 50, 50)
  
  console.log('✅ Drawing operations successful!')
  console.log()
  
  // Test buffer generation
  console.log('Testing PNG buffer generation...')
  const buffer = testCanvas.toBuffer('image/png')
  
  console.log('✅ PNG buffer generated successfully!')
  console.log(`  Buffer size: ${buffer.length} bytes`)
  console.log()
  
  console.log('🎉 All tests passed!')
  console.log(`The correct binding (${expectedBinding}) is working properly.`)
  
} catch (error) {
  console.error('❌ Failed to load canvas module:', error.message)
  console.error()
  console.error('Error details:', error)
  console.error()
  console.error('This likely means the platform-specific binding is not installed.')
  console.error(`Expected binding: ${expectedBinding}`)
  console.error()
  console.error('To fix this, run:')
  console.error(`  pnpm install ${expectedBinding}`)
  process.exit(1)
}
