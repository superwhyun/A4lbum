import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export const loadFaceApiModels = async () => {
    if (modelsLoaded) return;

    try {
        const MODEL_URL = '/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        // await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL); // 랜드마크까지 필요하면 사용
        modelsLoaded = true;
        console.log('Face API models loaded');
    } catch (error) {
        console.error('Failed to load Face API models:', error);
    }
};

export const detectFaceCenter = async (imageUrl: string): Promise<{ x: number, y: number } | null> => {
    if (!modelsLoaded) {
        await loadFaceApiModels();
    }

    return new Promise((resolve) => {
        const img = new Image();

        // Blob URL인 경우 crossOrigin 설정이 필요 없을 수 있음.
        // 하지만 외부 URL일 경우를 대비해 anonymous 설정은 유지하되, 에러 발생 시 재시도 로직 고려 가능.
        // 여기서는 에러 발생 시 null을 반환하여 전체 프로세스가 멈추지 않도록 함.
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;

        img.onload = async () => {
            try {
                // TinyFaceDetector 옵션
                const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());

                if (detections.length > 0) {
                    // 가장 큰 얼굴을 메인으로 간주
                    const mainFace = detections.reduce((prev, current) =>
                        (prev.box.width * prev.box.height > current.box.width * current.box.height) ? prev : current
                    );

                    const box = mainFace.box;
                    const centerX = box.x + (box.width / 2);
                    const centerY = box.y + (box.height / 2);

                    // 이미지 전체 크기 대비 비율 (0~100)
                    const percentX = (centerX / img.width) * 100;
                    const percentY = (centerY / img.height) * 100;

                    resolve({ x: percentX, y: percentY });
                } else {
                    resolve(null); // 얼굴 없음
                }
            } catch (error) {
                console.error('Face detection error:', error);
                resolve(null);
            }
        };

        img.onerror = (err) => {
            console.warn('Image load error in face detection (skipping):', imageUrl);
            // 이미지를 불러오지 못해도 에러를 던지지 않고 null을 반환하여 다음 사진으로 넘어가게 함
            resolve(null);
        };
    });
};
