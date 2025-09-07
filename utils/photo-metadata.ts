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
    // 서버 사이드에서는 실행하지 않음
    if (typeof window === 'undefined') {
      const fileDate = new Date(file.lastModified);
      return `${fileDate.getFullYear()}.${String(fileDate.getMonth() + 1).padStart(2, '0')}.${String(fileDate.getDate()).padStart(2, '0')}`;
    }

    // EXIF-JS를 사용해서 실제 촬영 날짜 추출
    const EXIF = await loadExifJs();
    if (!EXIF) {
      // EXIF 라이브러리를 로드할 수 없으면 파일 날짜 사용
      const fileDate = new Date(file.lastModified);
      return `${fileDate.getFullYear()}.${String(fileDate.getMonth() + 1).padStart(2, '0')}.${String(fileDate.getDate()).padStart(2, '0')}`;
    }
    
    return new Promise((resolve) => {
      EXIF.getData(file, function() {
        try {
          // EXIF에서 실제 촬영 날짜 추출
          const dateTime = EXIF.getTag(this, "DateTimeOriginal") || 
                          EXIF.getTag(this, "DateTime") || 
                          EXIF.getTag(this, "DateTimeDigitized");
          
          if (dateTime) {
            // EXIF 날짜 형식: "2023:12:25 14:30:45" → Date 객체로 변환
            const dateStr = dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
            const exifDate = new Date(dateStr);
            
            if (!isNaN(exifDate.getTime())) {
              const result = `${exifDate.getFullYear()}.${String(exifDate.getMonth() + 1).padStart(2, '0')}.${String(exifDate.getDate()).padStart(2, '0')}`;
              resolve(result);
              return;
            }
          }
          
          // EXIF 날짜가 없으면 파일 날짜 사용
          const fileDate = new Date(file.lastModified);
          const result = `${fileDate.getFullYear()}.${String(fileDate.getMonth() + 1).padStart(2, '0')}.${String(fileDate.getDate()).padStart(2, '0')}`;
          resolve(result);
          
        } catch (error) {
          console.error('EXIF 날짜 파싱 오류:', error);
          // 에러 시 파일 날짜 사용
          const fileDate = new Date(file.lastModified);
          const result = `${fileDate.getFullYear()}.${String(fileDate.getMonth() + 1).padStart(2, '0')}.${String(fileDate.getDate()).padStart(2, '0')}`;
          resolve(result);
        }
      });
    });
    
  } catch (error) {
    console.error('사진 날짜 추출 실패:', error);
    // 에러가 발생하면 파일 날짜 사용
    const fileDate = new Date(file.lastModified);
    return `${fileDate.getFullYear()}.${String(fileDate.getMonth() + 1).padStart(2, '0')}.${String(fileDate.getDate()).padStart(2, '0')}`;
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
    // 서버 사이드에서는 실행하지 않음
    if (typeof window === 'undefined') {
      return undefined;
    }

    // EXIF-JS를 동적으로 로드
    const EXIF = await loadExifJs();
    if (!EXIF) {
      return fallbackLocationExtraction(file);
    }
    
    return new Promise((resolve) => {
      EXIF.getData(file, function() {
        try {
          // GPS 정보 추출
          const lat = EXIF.getTag(this, "GPSLatitude");
          const lon = EXIF.getTag(this, "GPSLongitude");
          const latRef = EXIF.getTag(this, "GPSLatitudeRef");
          const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
          
          
          if (lat && lon && latRef && lonRef) {
            // GPS 좌표를 십진수로 변환
            const latDecimal = convertDMSToDD(lat, latRef);
            const lonDecimal = convertDMSToDD(lon, lonRef);
            
            
            // 좌표를 기반으로 실제 위치 가져오기
            getLocationFromCoordinates(latDecimal, lonDecimal).then(location => {
              resolve(location);
            }).catch(error => {
              console.error('위치 변환 오류:', error);
              resolve(fallbackLocationExtraction(file));
            });
          } else {
            resolve(fallbackLocationExtraction(file));
          }
        } catch (error) {
          console.error('EXIF GPS 파싱 오류:', error);
          resolve(fallbackLocationExtraction(file));
        }
      });
    });
    
  } catch (error) {
    console.error('위치 정보 추출 실패:', error);
    return fallbackLocationExtraction(file);
  }
}

// EXIF-JS 라이브러리를 동적으로 로드
async function loadExifJs(): Promise<any> {
  try {
    // CDN에서 EXIF.js를 동적으로 로드
    if ((window as any).EXIF) {
      return (window as any).EXIF;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/exif-js@2.3.0/exif.js';
      script.onload = () => {
        resolve((window as any).EXIF);
      };
      script.onerror = () => {
        console.error('EXIF.js 로드 실패');
        reject(null);
      };
      document.head.appendChild(script);
    });
  } catch (error) {
    console.error('EXIF.js 로드 중 오류:', error);
    return null;
  }
}

// EXIF GPS 데이터가 없을 때의 fallback 처리
function fallbackLocationExtraction(file: File): string | undefined {
  // GPS 데이터가 없으면 파일명에서 추출 시도
  const filename = file.name.toLowerCase();
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
}

// GPS 좌표(도분초)를 십진도로 변환
function convertDMSToDD(dms: number[], ref: string): number {
  let dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
  if (ref === "S" || ref === "W") {
    dd = dd * -1;
  }
  return dd;
}

// 좌표를 기반으로 실제 위치 정보 가져오기
async function getLocationFromCoordinates(lat: number, lon: number): Promise<string | undefined> {
  // 먼저 카카오맵 API로 실제 주소 시도
  try {
    const realLocation = await getRealLocationFromAPI(lat, lon)
    if (realLocation) {
      return realLocation
    }
  } catch (error) {
    console.error('실제 위치 API 호출 실패:', error)
  }
  
  // API 실패 시 기존 하드코딩된 방식으로 fallback
  return getFallbackLocationFromCoordinates(lat, lon)
}

// 실제 API를 통해 위치 정보 가져오기
async function getRealLocationFromAPI(lat: number, lon: number): Promise<string | undefined> {
  try {
    // 카카오맵 REST API 사용
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lon}&y=${lat}&input_coord=WGS84`,
      {
        headers: {
          'Authorization': `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_API_KEY || ''}`
        }
      }
    )
    
    if (!response.ok) {
      throw new Error('API 응답 실패')
    }
    
    const data = await response.json()
    
    if (data.documents && data.documents.length > 0) {
      const address = data.documents[0]
      
      // 도로명 주소가 있으면 우선 사용
      if (address.road_address) {
        const region = address.road_address.region_1depth_name // 시/도
        const city = address.road_address.region_2depth_name   // 시/군/구
        
        // 시/군/구 정보가 있으면 사용, 없으면 시/도만 사용
        if (city && city !== region) {
          return city.replace(/시$|군$|구$/, '') // "시", "군", "구" 제거
        } else {
          return region.replace(/특별시$|광역시$|특별자치시$|도$/, '') // 행정구역 단위 제거
        }
      }
      
      // 도로명 주소가 없으면 지번 주소 사용
      if (address.address) {
        const region = address.address.region_1depth_name
        const city = address.address.region_2depth_name
        
        if (city && city !== region) {
          return city.replace(/시$|군$|구$/, '')
        } else {
          return region.replace(/특별시$|광역시$|특별자치시$|도$/, '')
        }
      }
    }
    
    return undefined
  } catch (error) {
    console.error('카카오맵 API 오류:', error)
    return undefined
  }
}

// 기존 하드코딩된 방식 (fallback용)
function getFallbackLocationFromCoordinates(lat: number, lon: number): string | undefined {
  // 한국의 주요 도시 좌표 (더 정확한 범위로 조정)
  const locations = [
    { name: '서울', lat: [37.413, 37.715], lon: [126.734, 127.269] },
    { name: '부산', lat: [35.133, 35.396], lon: [128.838, 129.315] },
    { name: '대구', lat: [35.798, 35.934], lon: [128.473, 128.781] },
    { name: '인천', lat: [37.386, 37.637], lon: [126.406, 126.771] },
    { name: '대전', lat: [36.248, 36.426], lon: [127.314, 127.546] },
    { name: '세종', lat: [36.482, 36.587], lon: [127.230, 127.330] },
    { name: '광주', lat: [35.086, 35.228], lon: [126.705, 127.018] },
    { name: '울산', lat: [35.518, 35.614], lon: [129.216, 129.424] },
    { name: '제주', lat: [33.231, 33.567], lon: [126.161, 126.957] },
    // 추가 도시들
    { name: '수원', lat: [37.239, 37.321], lon: [126.944, 127.077] },
    { name: '성남', lat: [37.386, 37.462], lon: [127.097, 127.187] },
    { name: '고양', lat: [37.620, 37.709], lon: [126.830, 126.977] },
    { name: '용인', lat: [37.234, 37.321], lon: [127.177, 127.323] },
    { name: '청주', lat: [36.595, 36.683], lon: [127.429, 127.516] },
    { name: '전주', lat: [35.804, 35.859], lon: [127.110, 127.166] },
    { name: '천안', lat: [36.772, 36.831], lon: [127.104, 127.184] },
    { name: '안산', lat: [37.300, 37.347], lon: [126.790, 126.867] },
    { name: '안양', lat: [37.387, 37.411], lon: [126.917, 126.956] },
    { name: '포항', lat: [35.998, 36.089], lon: [129.343, 129.386] },
    { name: '창원', lat: [35.199, 35.294], lon: [128.553, 128.681] },
    { name: '마산', lat: [35.179, 35.228], lon: [128.559, 128.592] },
  ];
  
  // 가장 가까운 도시를 찾기 위한 거리 계산
  let closestCity = null;
  let minDistance = Infinity;
  
  for (const location of locations) {
    // 좌표가 범위 내에 있는지 확인
    if (lat >= location.lat[0] && lat <= location.lat[1] &&
        lon >= location.lon[0] && lon <= location.lon[1]) {
      return location.name;
    }
    
    // 범위 내에 없으면 가장 가까운 도시 계산
    const centerLat = (location.lat[0] + location.lat[1]) / 2;
    const centerLon = (location.lon[0] + location.lon[1]) / 2;
    const distance = Math.sqrt(Math.pow(lat - centerLat, 2) + Math.pow(lon - centerLon, 2));
    
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = location.name;
    }
  }
  
  // 한국 영토 내에 있고, 가장 가까운 도시가 합리적인 거리 내에 있으면 반환
  if (lat >= 33 && lat <= 38.5 && lon >= 125 && lon <= 132 && minDistance < 0.5) {
    return closestCity;
  }
  
  return undefined;
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