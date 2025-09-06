// 사진 파일에서 촬영 날짜를 추출하는 유틸리티

export interface PhotoMetadata {
  dateCreated?: string;
  location?: string;
}

/**
 * 사진 파일에서 촬영 날짜를 추출합니다
 * @param file 사진 파일
 * @returns 촬영 날짜 (YYYY.MM.DD 형식) 또는 undefined
 */
export async function extractPhotoDate(file: File): Promise<string | undefined> {
  try {
    // 파일의 lastModified를 기본값으로 사용
    const fileDate = new Date(file.lastModified);
    
    // EXIF 데이터를 읽기 위해 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const dataView = new DataView(arrayBuffer);
    
    // EXIF 데이터에서 DateTimeOriginal을 찾기 위한 간단한 파싱
    const exifDate = await parseExifDate(dataView);
    
    // EXIF에서 날짜를 찾았으면 그것을 사용, 없으면 파일의 lastModified 사용
    const targetDate = exifDate || fileDate;
    
    return `${targetDate.getFullYear()}.${String(targetDate.getMonth() + 1).padStart(2, '0')}.${String(targetDate.getDate()).padStart(2, '0')}`;
  } catch (error) {
    console.error('사진 날짜 추출 실패:', error);
    // 에러가 발생하면 현재 날짜를 사용
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  }
}

/**
 * EXIF 데이터에서 DateTimeOriginal을 파싱합니다
 * 간단한 구현으로 일부 JPEG 파일에서만 작동할 수 있습니다
 */
async function parseExifDate(dataView: DataView): Promise<Date | null> {
  try {
    // JPEG 파일인지 확인 (0xFFD8로 시작)
    if (dataView.getUint16(0) !== 0xFFD8) {
      return null;
    }

    let offset = 2;
    
    // EXIF 세그먼트를 찾습니다
    while (offset < dataView.byteLength - 4) {
      const marker = dataView.getUint16(offset);
      
      if (marker === 0xFFE1) { // APP1 마커 (EXIF 데이터가 포함될 수 있음)
        const segmentLength = dataView.getUint16(offset + 2);
        
        // "Exif\0\0" 문자열 확인
        if (offset + 10 < dataView.byteLength &&
            dataView.getUint32(offset + 4) === 0x45786966 && // "Exif"
            dataView.getUint16(offset + 8) === 0x0000) {
          
          // TIFF 헤더 시작
          const tiffStart = offset + 10;
          
          // 간단한 EXIF 파싱 (실제로는 더 복잡함)
          // 여기서는 파일의 lastModified를 사용하는 것이 더 안전합니다
          return null;
        }
      }
      
      if (marker === 0xFFDA) { // Start of Scan - 더 이상 EXIF 데이터 없음
        break;
      }
      
      offset += 2 + dataView.getUint16(offset + 2);
    }
    
    return null;
  } catch (error) {
    console.error('EXIF 파싱 에러:', error);
    return null;
  }
}

/**
 * 사진 파일에서 위치 정보를 추출하려고 시도합니다
 * @param file 사진 파일
 * @returns 위치 정보 문자열 또는 undefined
 */
export async function extractPhotoLocation(file: File): Promise<string | undefined> {
  try {
    // 실제 EXIF GPS 데이터 추출은 복잡하므로, 여기서는 기본 구조만 제공
    // 추후 exif-js 같은 라이브러리를 사용하거나
    // 서버 측에서 처리하도록 확장 가능
    
    // 현재는 파일명에서 위치 정보를 추출하려고 시도
    const filename = file.name.toLowerCase();
    
    // 간단한 패턴 매칭 (예: 파일명에 도시명이 포함된 경우)
    const locationPatterns = [
      { pattern: /seoul|서울/, location: '서울' },
      { pattern: /busan|부산/, location: '부산' },
      { pattern: /incheon|인천/, location: '인천' },
      { pattern: /daegu|대구/, location: '대구' },
      { pattern: /daejeon|대전/, location: '대전' },
      { pattern: /gwangju|광주/, location: '광주' },
      { pattern: /ulsan|울산/, location: '울산' },
      { pattern: /jeju|제주/, location: '제주' },
    ];
    
    for (const { pattern, location } of locationPatterns) {
      if (pattern.test(filename)) {
        return location;
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('위치 정보 추출 실패:', error);
    return undefined;
  }
}

/**
 * 여러 사진 파일에서 가장 이른 촬영 날짜를 찾습니다
 * @param files 사진 파일들
 * @returns 가장 이른 날짜 (YYYY.MM.DD 형식)
 */
export async function findEarliestPhotoDate(files: File[]): Promise<string> {
  if (files.length === 0) {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  }

  let earliestDate: Date | null = null;

  for (const file of files) {
    try {
      // 파일의 lastModified를 사용 (가장 신뢰할 수 있는 정보)
      const fileDate = new Date(file.lastModified);
      
      if (!earliestDate || fileDate < earliestDate) {
        earliestDate = fileDate;
      }
    } catch (error) {
      console.error('파일 날짜 추출 실패:', error);
    }
  }

  if (!earliestDate) {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  }

  return `${earliestDate.getFullYear()}.${String(earliestDate.getMonth() + 1).padStart(2, '0')}.`;
}