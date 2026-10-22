export async function prepareEventBanner(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file?.type)) throw new Error('Escolha uma foto JPG, PNG ou WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Escolha uma foto de até 20 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
      element.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 675;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a foto.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const sourceRatio = image.width / image.height;
    const targetRatio = canvas.width / canvas.height;
    const sourceWidth = sourceRatio > targetRatio ? image.height * targetRatio : image.width;
    const sourceHeight = sourceRatio > targetRatio ? image.height : image.width / targetRatio;
    context.drawImage(image,
      (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2,
      sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.58, 0.45]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= 450000) return dataUrl;
    }
    throw new Error('A foto ainda está muito grande. Escolha outra imagem.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
