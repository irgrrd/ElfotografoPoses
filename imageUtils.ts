
/**
 * Redimensiona una imagen Base64 manteniendo el aspect ratio.
 * @param base64Str La imagen original en base64
 * @param maxWidth El ancho (o alto) máximo permitido (default 1024)
 * @param quality Calidad JPEG (0 a 1)
 */
export const resizeImage = (base64Str: string, maxWidth = 1024, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calcular nuevas dimensiones manteniendo aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height *= maxWidth / width));
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width = Math.round((width *= maxWidth / height));
          height = maxWidth;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str); // Fallback si falla el contexto
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Retornar como JPEG para optimizar tamaño
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => {
      console.warn("Fallo al redimensionar imagen, usando original.");
      resolve(base64Str);
    };
  });
};
