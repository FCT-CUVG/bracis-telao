/* ZIP clássico: leitura local de entradas stored/deflate e exportação sem dependências. */
window.AlbumZip = (() => {
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();
  const table = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  async function open(file) {
    if (file.size > 750 * 1024 * 1024) throw Error('Este ZIP passa de 750 MB. Divida o álbum em arquivos menores.');
    const data = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(data.buffer);
    let end = -1;
    for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === data.length) { end = i; break; }
    }
    if (end < 0) throw Error('ZIP inválido ou incompleto. Tente compactar a pasta novamente.');
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw Error('ZIP dividido em volumes não é compatível. Use um único ZIP.');
    const count = view.getUint16(end + 10, true);
    const directorySize = view.getUint32(end + 12, true);
    let offset = view.getUint32(end + 16, true);
    if (count === 65535 || offset === 0xffffffff || directorySize === 0xffffffff) throw Error('Use ZIP comum, sem ZIP64. Divida o álbum em arquivos menores.');
    if (offset + directorySize > end || count > 10000) throw Error('A estrutura deste ZIP não é compatível.');
    const entries = [];
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw Error('O índice do ZIP está corrompido.');
      const flags = view.getUint16(offset + 8, true);
      const method = view.getUint16(offset + 10, true);
      const crc = view.getUint32(offset + 16, true);
      const packed = view.getUint32(offset + 20, true);
      const size = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const next = offset + 46 + nameLength + extraLength + commentLength;
      if (next > end) throw Error('O índice do ZIP está incompleto.');
      const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength));
      entries.push({ name, size, crc, async read() {
        if (flags & 1) throw Error('ZIP com senha não é compatível.');
        if (size > 80 * 1024 * 1024) throw Error('Uma foto excede o limite de 80 MB.');
        if (localOffset + 30 > data.length || view.getUint32(localOffset, true) !== 0x04034b50) throw Error('Entrada corrompida no ZIP.');
        const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
        if (start + packed > data.length) throw Error('Arquivo truncado dentro do ZIP.');
        let bytes;
        if (method === 0) bytes = data.subarray(start, start + packed);
        else if (method === 8) {
          let decompressor;
          try { decompressor = new DecompressionStream('deflate-raw'); }
          catch { throw Error('Seu navegador não lê este ZIP. Atualize o navegador ou selecione as fotos descompactadas.'); }
          const reader = new Blob([data.subarray(start, start + packed)]).stream().pipeThrough(decompressor).getReader();
          const chunks = []; let total = 0;
          try {
            while (true) {
              const { done, value } = await reader.read(); if (done) break;
              total += value.length;
              if (total > size || total > 80 * 1024 * 1024) { await reader.cancel(); throw Error('O tamanho descompactado não corresponde ao ZIP.'); }
              chunks.push(value);
            }
          } finally { reader.releaseLock(); }
          bytes = new Uint8Array(total); let cursor = 0;
          for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length; }
        } else throw Error('Método de compressão não compatível. Use ZIP padrão (deflate).');
        if (bytes.length !== size || crc32(bytes) !== crc) throw Error('Arquivo corrompido: a verificação do ZIP falhou.');
        return new Blob([bytes]);
      } });
      offset = next;
    }
    return entries;
  }
  async function pack(files) {
    const locals = [], directories = []; let cursor = 0;
    for (const file of files) {
      const bytes = new Uint8Array(await file.blob.arrayBuffer());
      const name = encoder.encode(file.name); const crc = crc32(bytes);
      const local = new Uint8Array(30 + name.length); const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true);
      lv.setUint16(12, 33, true); lv.setUint32(14, crc, true); lv.setUint32(18, bytes.length, true); lv.setUint32(22, bytes.length, true); lv.setUint16(26, name.length, true); local.set(name, 30);
      const directory = new Uint8Array(46 + name.length); const dv = new DataView(directory.buffer);
      dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true); dv.setUint16(8, 0x800, true); dv.setUint16(14, 33, true);
      dv.setUint32(16, crc, true); dv.setUint32(20, bytes.length, true); dv.setUint32(24, bytes.length, true); dv.setUint16(28, name.length, true); dv.setUint32(42, cursor, true); directory.set(name, 46);
      locals.push(local, bytes); directories.push(directory); cursor += local.length + bytes.length;
    }
    const directorySize = directories.reduce((sum, x) => sum + x.length, 0);
    const end = new Uint8Array(22); const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, directorySize, true); ev.setUint32(16, cursor, true);
    return new Blob([...locals, ...directories, end], { type: 'application/zip' });
  }
  return { open, pack };
})();
