const sections = [
  {
    title: 'Who We Are',
    body: 'StudentNest helps people looking for accommodation connect with property owners and agents. We are initially focused on the Federal University of Lafia community and the surrounding areas.'
  },
  {
    title: 'Our Mission',
    body: 'Our mission is to make accommodation searching easier, more accessible, and more transparent by bringing useful property information and search tools together.'
  },
  {
    title: 'Our Vision',
    body: 'We aim to build a trusted accommodation platform that can eventually serve other university communities while continuing to improve the experience for students, property owners, and agents.'
  },
  {
    title: 'What We Offer',
    body: 'StudentNest provides accommodation listings, location-based search, property details, and tools that help students browse options and help property agents manage their listings.'
  },
  {
    title: 'Why Choose StudentNest',
    body: 'Compare available property information in one place, narrow options with search filters, and open listing details when you want to learn more. StudentNest makes it more convenient to explore accommodation choices.'
  }
];

const questions = [
  {
    question: 'How can I search for accommodation?',
    answer: 'Visit Listings to browse properties. Use the search field and location, property type, and price filters to narrow the results.'
  },
  {
    question: 'Do I need an account to browse listings?',
    answer: 'You can browse public listings and view property details without registering. An account is needed for features that require a signed-in student or agent.'
  },
  {
    question: 'How can I list a property?',
    answer: 'Create an account and choose the agent registration option. Agent listing tools are available after signing in.'
  },
  {
    question: 'Does a listing guarantee that a property is available?',
    answer: 'Availability can change. Review the property details and contact the listed agent or owner to confirm current information before making arrangements.'
  },
  {
    question: 'How do I contact StudentNest support?',
    answer: 'Use the Contact Us page to send an inquiry or reach us by phone, WhatsApp, or email.'
  }
];

const AboutUs = () => (
  <section className="mx-auto max-w-5xl space-y-8">
    <header className="rounded-3xl bg-gradient-to-br from-primary/10 via-white to-white p-6 shadow-card ring-1 ring-slate-200 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">About StudentNest</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Welcome to StudentNest</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
        StudentNest is an accommodation platform designed to help the Federal University of Lafia community explore housing options and connect with property owners and agents.
      </p>
    </header>

    <div className="grid gap-5 md:grid-cols-2">
      {sections.map(({ title, body }) => (
        <article key={title} className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-3 leading-7 text-slate-600">{body}</p>
        </article>
      ))}
    </div>

    <section className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200 sm:p-8">
      <h2 className="text-2xl font-semibold text-slate-950">Frequently Asked Questions</h2>
      <div className="mt-5 divide-y divide-slate-200">
        {questions.map(({ question, answer }) => (
          <details key={question} className="py-4">
            <summary className="cursor-pointer font-medium text-slate-900">{question}</summary>
            <p className="mt-3 leading-7 text-slate-600">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  </section>
);

export default AboutUs;
