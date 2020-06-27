import TcpSocket from 'react-native-tcp-socket'
import binaryToBase64 from 'binaryToBase64'
const Buffer = (global.Buffer = global.Buffer || require('buffer').Buffer)

export default class Socket {
  static myInstance = null

  server = null
  socket = null
  isConnected = false

  // Image data
  imageData = null
  imageDataStart = false
  lastImageUpdate = null

  // Default event functions
  onData = () => {}
  onImageReceived = () => {}
  onError = (error) => {
    console.warn(error)
  }
  onClose = (error) => {
    console.log('Socket server client connection closed ' + (error || ''))
  }

  static getInstance () {
    if (Socket.myInstance == null) {
      Socket.myInstance = new Socket()
    }

    return Socket.myInstance
  }

  connect = (host, port, onConnect = () => {}) => {
    if (this.isConnected) {
      onConnect({host, port})
      return
    }
    this.server = TcpSocket.createServer((socket) => {
      this.socket = socket
      socket.on('data', this.onData)
      socket.on('error', this.onError)
      socket.on('close', this.onClose)
    }).listen(
      { host, port, reuseAddress: true },
      (error) => {
        if (error) {
          console.warn(`Failed to connect to ${host}:${port} -` + error)
          this.onError(error)
        } else {
          this.isConnected = true
          onConnect({host, port})
        }
      }
    )
  }

  isConnected = () => {
    return this.isConnected
  }

  setOnData = (onData) => {
    this.onData = onData
  }

  setOnImageReceived = (onImageReceived) => {
    this.resetImageData()
    this.onData = this.onImageData
    this.onImageReceived = onImageReceived
  }

  setOnError = (onError) => {
    this.onError = onError
  }

  setOnClose = (onClose) => {
    this.onClose = onClose
  }

  resetImageData = () => {
    this.imageData = null
    this.imageDataStart = false
    this.lastImageUpdate = null
  }

  onImageData = (chunk) => {
    if (!this.imageDataStart) {
      const startIndex = chunk.indexOf('\xFF\xD8', 0, 'binary')
      if (startIndex >= 0) {
        this.imageData = chunk.subarray(startIndex)
        this.imageDataStart = true
      }
    } else {
      const endIndex = chunk.indexOf('\xFF\xD9', 0, 'binary')
      if (endIndex >= 0 || this.imageData.length > 2900) {
        let imageBuffer = this.imageData
        if (endIndex >= 0) {
          imageBuffer = Buffer.concat([
            this.imageData,
            chunk.subarray(0, endIndex + 2)
          ])
        }
        const encodedData = binaryToBase64(imageBuffer)
        this.onImageReceived(encodedData)
        this.imageDataStart = false
      } else {
        this.imageData = Buffer.concat([this.imageData, chunk])
      }
    }
  }

  write = (action) => {
    if (this.socket && this.isConnected) {
      this.socket.write(Buffer.from([action]))
    }
  }

  close = () => {
    if (this.server) {
      this.server.close()
      this.server = null
      this.socket = null
      this.isConnected = false
    }
  }
}
