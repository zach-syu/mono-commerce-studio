export type ProductBrief = { name: string; category: string; description: string; facts: string[] };
export function demoCopy(product: ProductBrief, language: string) {
  const lines: Record<string, string[][]> = {
    'zh-TW': [['今天，留一點好給自己','用你喜歡的方式，讓日常多一點選擇。'],['看見商品的細節','從外觀到使用情境，找到適合自己的選擇。'],['日常的剛剛好','從一件喜歡的商品，開始安排自己的日常。'],['認識這件商品','規格、成分與使用方式，請以實際商品標示為準。']],
    en: [['A little more for your everyday','Make room for the things that fit your routine.'],['Discover the details','Explore the look and find the right fit for your day.'],['Made part of your routine','Start with one thing you enjoy and make it your own.'],['Know your product','Check the actual product label for specifications and directions.']],
    ja: [['毎日に、小さなお気に入りを','自分らしい選び方で、毎日を少し心地よく。'],['細部まで、じっくりと','見た目や使う場面から、自分に合う一品を。'],['いつもの暮らしに','お気に入りの一品から、毎日を整えてみませんか。'],['商品について','仕様や使用方法は、実際の商品表示をご確認ください。']],
    ko: [['일상에 더하는 작은 선택','나만의 방식으로 매일을 채워 보세요.'],['디테일을 살펴보세요','디자인과 사용 장면을 보고 나에게 맞는 제품을 찾아보세요.'],['매일의 순간에','좋아하는 제품 하나로 나만의 일상을 만들어 보세요.'],['제품을 확인하세요','규격과 사용 방법은 실제 제품 표시를 확인해 주세요.']],
  };
  const copy = lines[language] || lines['zh-TW'];
  // Translate only the fixture facts we authored. Arbitrary merchant facts require the live translator.
  const knownFacts: Record<string,Record<string,string>> = {
    '示範包裝。茶葉商品。實際成分、重量與產地待商家補充。': {
      en:'Sample tea packaging. Ingredients, net weight, and origin must be supplied by the merchant.',
      ja:'お茶のサンプルパッケージです。原材料、内容量、原産地は販売者による確認が必要です。',
      ko:'차 제품의 예시 포장입니다. 원재료, 중량, 원산지는 판매자의 확인이 필요합니다.'
    },
    '示範精華液包裝。實際成分、容量與使用方式待商家補充。': {
      en:'Sample serum packaging. Ingredients, volume, and directions must be supplied by the merchant.',
      ja:'美容液のサンプルパッケージです。成分、容量、使用方法は販売者による確認が必要です。',
      ko:'세럼의 예시 포장입니다. 성분, 용량, 사용 방법은 판매자의 확인이 필요합니다.'
    },
    '示範休閒鞋。米白與鼠尾草綠配色。材質、尺寸與產地待商家補充。': {
      en:'Sample casual sneakers in off-white and sage green. Materials, sizes, and origin must be supplied by the merchant.',
      ja:'オフホワイトとセージグリーンのカジュアルシューズのサンプルです。素材、サイズ、原産地は販売者による確認が必要です。',
      ko:'오프화이트와 세이지 그린 색상의 캐주얼 운동화 예시입니다. 소재, 사이즈, 원산지는 판매자의 확인이 필요합니다.'
    },
  };
  const raw=product.facts.join(' · ');
  const verifiedFixtureTranslation=knownFacts[raw]?.[language];
  return copy.map(([title, body], i) => ({ id: ['hero','details','lifestyle','specs'][i], title, body: i === 3 && raw ? language==='zh-TW' ? raw : verifiedFixtureTranslation || body : body, selected: true }));
}
