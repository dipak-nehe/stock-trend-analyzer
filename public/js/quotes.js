// Quotes for the start page: one a day, in English and Spanish. Only the author is shown; each quote's source is kept
// here so its wording can be checked. Every English quote is word for word from its source:
// - Warren Buffett: Berkshire Hathaway's shareholder letter of that year (berkshirehathaway.com/letters);
// - Peter Lynch, Charlie Munger and John Bogle: the books, speeches and interviews listed with each one (as cited on
//   Wikiquote's sourced lists);
// - JL Collins: his own blog post "Stocks — Part I" (jlcollinsnh.com, 2012), from the stock series behind his book.
export const BUFFETT_QUOTES = [
  { year: 1979, en: "The primary test of managerial economic performance is the achievement of a high earnings rate on equity capital employed (without undue leverage, accounting gimmickry, etc.) and not the achievement of consistent gains in earnings per share.",
    es: "La prueba principal del desempeño económico de una dirección es lograr una alta rentabilidad sobre el capital propio empleado (sin un apalancamiento excesivo, trucos contables, etc.), y no lograr aumentos constantes del beneficio por acción." },
  { year: 1985, en: "When a management with a reputation for brilliance tackles a business with a reputation for poor fundamental economics, it is the reputation of the business that remains intact.",
    es: "Cuando una dirección con fama de brillante se enfrenta a un negocio con fama de malos fundamentos económicos, es la fama del negocio la que permanece intacta." },
  { year: 1985, en: "Should you find yourself in a chronically-leaking boat, energy devoted to changing vessels is likely to be more productive than energy devoted to patching leaks.",
    es: "Si te encuentras en un barco que hace agua sin parar, la energía dedicada a cambiar de embarcación probablemente será más productiva que la dedicada a tapar las vías de agua." },
  { year: 1987, en: "Mr. Market is there to serve you, not to guide you.",
    es: "Mr. Market está ahí para servirte, no para guiarte." },
  { year: 1987, en: "Severe change and exceptional returns usually don’t mix.",
    es: "Los cambios drásticos y los rendimientos excepcionales no suelen ir de la mano." },
  { year: 1988, en: "In fact, when we own portions of outstanding businesses with outstanding managements, our favorite holding period is forever.",
    es: "De hecho, cuando tenemos participaciones en empresas excepcionales con directivos excepcionales, nuestro plazo de inversión favorito es para siempre." },
  { year: 1989, en: "It’s far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",
    es: "Es mucho mejor comprar una empresa maravillosa a un precio justo que una empresa corriente a un precio maravilloso." },
  { year: 1989, en: "Time is the friend of the wonderful business, the enemy of the mediocre.",
    es: "El tiempo es amigo del negocio maravilloso y enemigo del mediocre." },
  { year: 1989, en: "After 25 years of buying and supervising a great variety of businesses, Charlie and I have not learned how to solve difficult business problems. What we have learned is to avoid them.",
    es: "Tras 25 años comprando y supervisando una gran variedad de negocios, Charlie y yo no hemos aprendido a resolver los problemas empresariales difíciles. Lo que hemos aprendido es a evitarlos." },
  { year: 1992, en: "Leaving the question of price aside, the best business to own is one that over an extended period can employ large amounts of incremental capital at very high rates of return.",
    es: "Dejando a un lado el precio, el mejor negocio que se puede tener es uno que, durante un largo periodo, puede invertir grandes cantidades de capital adicional a tasas de rentabilidad muy altas." },
  { year: 1992, en: "We’ve long felt that the only value of stock forecasters is to make fortune tellers look good.",
    es: "Hace tiempo que pensamos que la única utilidad de quienes pronostican la bolsa es hacer quedar bien a los adivinos." },
  { year: 1993, en: "Charlie and I decided long ago that in an investment lifetime it’s just too hard to make hundreds of smart decisions.",
    es: "Charlie y yo decidimos hace mucho que, a lo largo de toda una vida de inversión, es simplemente demasiado difícil tomar cientos de decisiones acertadas." },
  { year: 1994, en: "We will continue to ignore political and economic forecasts, which are an expensive distraction for many investors and businessmen.",
    es: "Seguiremos ignorando las previsiones políticas y económicas, que son una distracción costosa para muchos inversores y empresarios." },
  { year: 1994, en: "We try to price, rather than time, purchases.",
    es: "Intentamos acertar con el precio, no con el momento, de nuestras compras." },
  { year: 1994, en: "Investors should remember that their scorecard is not computed using Olympic-diving methods: Degree-of-difficulty doesn’t count.",
    es: "Los inversores deben recordar que su puntuación no se calcula como en los saltos olímpicos: la dificultad no cuenta." },
  { year: 2001, en: "Predicting rain doesn’t count; building arks does.",
    es: "Predecir la lluvia no cuenta; construir arcas, sí." },
  { year: 2004, en: "You only learn who has been swimming naked when the tide goes out.",
    es: "Solo descubres quién ha estado nadando desnudo cuando baja la marea." },
  { year: 2004, en: "Investors should remember that excitement and expenses are their enemies.",
    es: "Los inversores deben recordar que la emoción y los gastos son sus enemigos." },
  { year: 2007, en: "A truly great business must have an enduring ‘moat’ that protects excellent returns on invested capital.",
    es: "Un negocio verdaderamente excelente debe tener un ‘foso’ duradero que proteja una rentabilidad excelente sobre el capital invertido." },
  { year: 2008, en: "Whether we’re talking about socks or stocks, I like buying quality merchandise when it is marked down.",
    es: "Ya hablemos de calcetines o de acciones, me gusta comprar mercancía de calidad cuando está rebajada." },
  { year: 2008, en: "Beware the investment activity that produces applause; the great moves are usually greeted by yawns.",
    es: "Desconfía de la inversión que provoca aplausos; los grandes movimientos suelen recibirse con bostezos." },
  { year: 2008, en: "When investing, pessimism is your friend, euphoria the enemy.",
    es: "Al invertir, el pesimismo es tu amigo y la euforia, tu enemiga." },
  { year: 2013, en: "You don’t need to be an expert in order to achieve satisfactory investment returns.",
    es: "No hace falta ser un experto para obtener rendimientos satisfactorios de la inversión." },
  { year: 2013, en: "Games are won by players who focus on the playing field – not by those whose eyes are glued to the scoreboard.",
    es: "Los partidos los ganan los jugadores que se concentran en el terreno de juego, no los que tienen los ojos pegados al marcador." },
  { year: 2013, en: "Forming macro opinions or listening to the macro or market predictions of others is a waste of time.",
    es: "Formarse opiniones macroeconómicas o escuchar las predicciones macroeconómicas o de mercado de otros es una pérdida de tiempo." },
  { year: 2013, en: "A climate of fear is your friend when investing; a euphoric world is your enemy.",
    es: "Un clima de miedo es tu amigo cuando inviertes; un mundo eufórico es tu enemigo." },
  { year: 2013, en: "Charlie and I have always considered a ‘bet’ on ever-rising U.S. prosperity to be very close to a sure thing.",
    es: "Charlie y yo siempre hemos considerado que una ‘apuesta’ por la prosperidad creciente de Estados Unidos es casi una apuesta segura." },
  { year: 2014, en: "It’s better to have a partial interest in the Hope Diamond than to own all of a rhinestone.",
    es: "Es mejor tener una participación en el diamante Hope que ser dueño de todo un diamante de imitación." },
  { year: 2015, en: "For 240 years it’s been a terrible mistake to bet against America, and now is no time to start.",
    es: "Durante 240 años ha sido un error terrible apostar contra Estados Unidos, y ahora no es momento de empezar." },
  { year: 2017, en: "Charlie and I view the marketable common stocks that Berkshire owns as interests in businesses, not as ticker symbols to be bought or sold based on their ‘chart’ patterns, the ‘target’ prices of analysts or the opinions of media pundits.",
    es: "Charlie y yo vemos las acciones cotizadas que posee Berkshire como participaciones en negocios, no como símbolos bursátiles que se compran o venden según sus patrones ‘gráficos’, los precios ‘objetivo’ de los analistas o las opiniones de los comentaristas de los medios." },
  { year: 2017, en: "Stick with big, ‘easy’ decisions and eschew activity.",
    es: "Quédate con las decisiones grandes y ‘fáciles’ y evita la actividad." },
];

// Peter Lynch, Charlie Munger, John Bogle and JL Collins
export const OTHER_QUOTES = [
  { author: "Peter Lynch", source: "One Up on Wall Street (1989)",
    en: "When somebody says, ‘Any idiot could run this joint,’ that’s a plus as far as I’m concerned, because sooner or later any idiot probably is going to be running it.",
    es: "Cuando alguien dice “cualquier idiota podría dirigir este negocio”, para mí es un punto a favor, porque tarde o temprano probablemente lo dirigirá algún idiota." },
  { author: "Charlie Munger", source: "Speech at USC Business School, 1994 (A Lesson on Elementary, Worldly Wisdom)",
    en: "Obviously, you have to know accounting. It’s the language of practical business life.",
    es: "Evidentemente, hay que saber contabilidad. Es el lenguaje de la vida práctica de los negocios." },
  { author: "John Bogle", source: "Princeton senior thesis, 1951",
    en: "The principal role of the mutual fund is to serve its investors.",
    es: "La función principal de un fondo de inversión es servir a sus inversores." },
  { author: "JL Collins", source: "Stocks — Part I, jlcollinsnh.com (2012)",
    en: "Market crashes are to be expected.",
    es: "Las caídas del mercado son de esperar." },
  { author: "Peter Lynch", source: "Interview with Charlie Rose, March 4, 1993",
    en: "If you don’t understand a company, if you can’t explain it to a ten-year-old in 2 minutes or less, don’t own it.",
    es: "Si no entiendes una empresa, si no puedes explicársela a un niño de diez años en 2 minutos o menos, no la tengas." },
  { author: "Charlie Munger", source: "Quoted in The Sydney Morning Herald, May 18, 2018",
    en: "Show me the incentive and I will show you the outcome.",
    es: "Enséñame el incentivo y te enseñaré el resultado." },
  { author: "John Bogle", source: "Speech to the Financial Analysts of Philadelphia, February 15, 2001",
    en: "Yes, the investor is often his own worst enemy.",
    es: "Sí, el inversor es a menudo su peor enemigo." },
  { author: "JL Collins", source: "Stocks — Part I, jlcollinsnh.com (2012)",
    en: "Everybody makes money when the market is rising. But what determines whether it will make you wealthy or leave you bleeding on the side of the road, is what you do during the times it is collapsing.",
    es: "Todo el mundo gana dinero cuando el mercado sube. Pero lo que determina si te hará rico o te dejará tirado en la cuneta es lo que haces cuando se está desplomando." },
  { author: "Peter Lynch", source: "Interview with Charlie Rose, October 28, 1997",
    en: "Corporate profits will be a lot higher 10 years from now. They’ll be a lot higher 20 years from now. That’s what you can rely on.",
    es: "Los beneficios empresariales serán mucho más altos dentro de 10 años. Serán mucho más altos dentro de 20 años. Con eso puedes contar." },
  { author: "Charlie Munger", source: "A Conversation with Charles T. Munger, Caltech, December 17, 2020",
    en: "What I would say is the single most important thing, if you want to avoid all the stupid errors, is knowing where you’re competent and where you aren’t.",
    es: "Diría que lo más importante, si quieres evitar todos los errores tontos, es saber en qué eres competente y en qué no." },
  { author: "John Bogle", source: "Speech at Trinity University, April 16, 2001",
    en: "The courage to press on regardless—regardless of whether we face calm seas or rough seas, and especially when the market storms howl around us—is the quintessential attribute of the successful investor.",
    es: "El valor de seguir adelante pase lo que pase —tanto si el mar está en calma como si está agitado, y sobre todo cuando arrecian las tormentas del mercado— es la cualidad esencial del inversor de éxito." },
  { author: "JL Collins", source: "Stocks — Part I, jlcollinsnh.com (2012)",
    en: "Recognize the counterproductive psychology that causes bad investment decisions and correct it in yourself.",
    es: "Reconoce la psicología contraproducente que lleva a malas decisiones de inversión y corrígela en ti mismo." },
  { author: "Charlie Munger", source: "Berkshire Hathaway annual meeting, 1999 (afternoon session)",
    en: "The hard part of the process for most people is the first $100,000.",
    es: "Lo difícil del proceso, para la mayoría de la gente, son los primeros 100.000 dólares." },
  { author: "John Bogle", source: "Gilbert Lecture, Princeton University, February 21, 2013",
    en: "The zero-sum game before costs becomes a loser’s game after costs.",
    es: "El juego de suma cero antes de costes se convierte en un juego de perdedores después de costes." },
  { author: "Charlie Munger", source: "Poor Charlie’s Almanack (2005), p. 100",
    en: "The idea that it is hard to find good investments, so concentrate in a few, seems to me to be an obvious idea.",
    es: "La idea de que es difícil encontrar buenas inversiones, así que hay que concentrarse en unas pocas, me parece una idea obvia." },
  { author: "John Bogle", source: "Bogleheads conference, 2018",
    en: "For God’s sake, don’t stop a program of regular investing because the market goes down.",
    es: "Por el amor de Dios, no dejes de invertir con regularidad porque baje el mercado." },
];

/**
 * All the quotes in the order they're shown: the others spread evenly among Buffett's (each list keeps its own
 * order), so the other authors come round every few days.
 * @type {{ author: string, source: string, en: string, es: string }[]}
 */
export const QUOTES = [
  ...BUFFETT_QUOTES.map((q, i) => ({ key: (i + 0.5) / BUFFETT_QUOTES.length, q: { author: "Warren Buffett", source: `Berkshire Hathaway shareholder letter, ${q.year}`, en: q.en, es: q.es } })),
  ...OTHER_QUOTES.map((q, i) => ({ key: (i + 0.5) / OTHER_QUOTES.length, q })),
].sort((a, b) => a.key - b.key).map((x) => x.q);

/** Day of the year, 0 for January 1 (local date, so it changes at the visitor's midnight). @param {Date} date */
const dayOfYear = (date) => Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 864e5);

/** Today's quote: the same for everyone all day, the next one each day, going through every quote in turn.
 * @param {Date} [date] */
export function quoteOfTheDay(date = new Date()) {
  return QUOTES[dayOfYear(date) % QUOTES.length];
}
