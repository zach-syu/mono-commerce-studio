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
  const roles=['hero','benefits','detail','lifestyle','specs'] as const;
  const detailTitles:Record<string,string>={'zh-TW':'靠近一點，看見細節',en:'A closer look',ja:'細部を、もっと近くで',ko:'더 가까이 보는 디테일'};
  const detailBodies:Record<string,string>={'zh-TW':'從外觀到包裝，細節值得好好看。',en:'Take a closer look at the product and its packaging.',ja:'商品の見た目やパッケージを、じっくりご覧ください。',ko:'제품의 외관과 포장을 자세히 살펴보세요.'};
  const goals:Record<string,string[]>= {
    'zh-TW':['以大幅商品與立體光影建立第一印象。','用少量重點和圖文模組整理賣點。','從原圖放大局部，不生成不存在的細節。','讓商品出現在適合的日常場景。','用資訊表整理已提供規格，缺項標示未提供。'],
    en:['Create a strong campaign hero with generous product scale.','Arrange the supplied points in concise visual modules.','Enlarge actual reference details without inventing new ones.','Show the product in an appropriate everyday setting.','Present supplied facts in a legible specification table.'],
    ja:['大きな商品写真で、第一印象を伝える。','提供された情報を、見やすい要点に整理する。','元の写真の細部を拡大し、未確認の形状は作らない。','日常の使用場面が伝わる構図にする。','確認できる商品情報を表でまとめる。'],
    ko:['큰 제품 사진으로 첫인상을 전달합니다.','제공된 정보를 간결한 시각 모듈로 정리합니다.','원본 사진의 디테일만 확대합니다.','알맞은 일상 장면에 제품을 배치합니다.','제공된 제품 정보를 표로 정리합니다.']
  };
  return roles.map((role,i)=>{
    const [title,body]=copy[[0,1,1,2,3][i]];
    return {id:role,role,title:role==='detail'?(detailTitles[language]||detailTitles['zh-TW']):title,body:role==='specs'&&raw?(language==='zh-TW'?raw:verifiedFixtureTranslation||body):role==='detail'?(detailBodies[language]||detailBodies['zh-TW']):body,visualGoal:(goals[language]||goals['zh-TW'])[i],selected:true};
  });
}
