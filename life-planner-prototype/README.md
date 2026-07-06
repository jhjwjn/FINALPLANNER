# Life Planner Prototype

개인 일정, 습관, 목표, 프로젝트, 회고, 꿈/비전, AI 프롬프트까지 합친 예시 앱입니다.

## 실행

```bash
cd /Users/jinyeong/Desktop/Planner/life-planner-prototype
python3 -m http.server 5180
```

브라우저에서 `http://127.0.0.1:5180` 접속.

## 저장 방식

브라우저 IndexedDB에 저장됩니다. 인터넷 연결 없이도 기존 데이터 조회/수정/추가가 됩니다.
브라우저 사이트 데이터 삭제, 시크릿 모드, 다른 브라우저 사용 시 데이터가 분리될 수 있습니다.
