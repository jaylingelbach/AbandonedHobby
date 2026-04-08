import {
  BUSINESS_CITY_STATE_ZIP,
  BUSINESS_COUNTRY,
  BUSINESS_STREET,
  EMAIL_DISPLAY_JAY,
  EMAIL_HREF_JAY,
  PHONE_DISPLAY,
  PHONE_HREF
} from '@/constants';

export default function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-gray-700 leading-relaxed">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">COOKIE POLICY</h1>
      <p className="text-gray-500 mb-8">
        <strong>Last updated</strong> April 08, 2026
      </p>

      <p>
        This Cookie Policy explains how Abandoned Hobby (&quot;Company,&quot;
        &quot;we,&quot; &quot;us,&quot; and &quot;our&quot;) uses cookies and
        similar technologies to recognize you when you visit our website at{' '}
        <a
          href="https://www.abandonedhobby.com"
          className="text-blue-600 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://www.abandonedhobby.com
        </a>{' '}
        (&quot;Website&quot;). It explains what these technologies are and why
        we use them, as well as your rights to control our use of them.
      </p>
      <p className="mt-3">
        In some cases we may use cookies to collect personal information, or
        that becomes personal information if we combine it with other
        information.
      </p>

      <Section title="What are cookies?">
        <p>
          Cookies are small data files that are placed on your computer or
          mobile device when you visit a website. Cookies are widely used by
          website owners in order to make their websites work, or to work more
          efficiently, as well as to provide reporting information.
        </p>
        <p className="mt-3">
          Cookies set by the website owner (in this case, Abandoned Hobby) are
          called &quot;first-party cookies.&quot; Cookies set by parties other
          than the website owner are called &quot;third-party cookies.&quot;
          Third-party cookies enable third-party features or functionality to be
          provided on or through the website (e.g., advertising, interactive
          content, and analytics). The parties that set these third-party
          cookies can recognize your computer both when it visits the website in
          question and also when it visits certain other websites.
        </p>
      </Section>

      <Section title="Why do we use cookies?">
        <p>
          We use first- and third-party cookies for several reasons. Some
          cookies are required for technical reasons in order for our Website to
          operate, and we refer to these as &quot;essential&quot; or
          &quot;strictly necessary&quot; cookies. Other cookies also enable us
          to track and target the interests of our users to enhance the
          experience on our Online Properties. Third parties serve cookies
          through our Website for advertising, analytics, and other purposes.
          This is described in more detail below.
        </p>
      </Section>

      <Section title="How can I control cookies?">
        <p>
          You have the right to decide whether to accept or reject cookies. You
          can exercise your cookie rights by setting your preferences in the
          Cookie Preference Center. The Cookie Preference Center allows you to
          select which categories of cookies you accept or reject. Essential
          cookies cannot be rejected as they are strictly necessary to provide
          you with services.
        </p>
        <p className="mt-3">
          The Cookie Preference Center can be found in the notification banner
          and on our Website. If you choose to reject cookies, you may still use
          our Website though your access to some functionality and areas of our
          Website may be restricted. You may also set or amend your web browser
          controls to accept or refuse cookies.
        </p>
        <p className="mt-3">
          The specific types of first- and third-party cookies served through
          our Website and the purposes they perform are described in the table
          below (please note that the specific cookies served may vary depending
          on the specific Online Properties you visit).
        </p>
      </Section>

      <Section title="How can I control cookies on my browser?">
        <p>
          As the means by which you can refuse cookies through your web browser
          controls vary from browser to browser, you should visit your
          browser&apos;s help menu for more information. The following is
          information about how to manage cookies on the most popular browsers:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          {[
            'Chrome',
            'Internet Explorer',
            'Firefox',
            'Safari',
            'Edge',
            'Opera'
          ].map((browser) => (
            <li key={browser}>{browser}</li>
          ))}
        </ul>
        <p className="mt-3">
          In addition, most advertising networks offer you a way to opt out of
          targeted advertising. If you would like to find out more information,
          please visit:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>
            <a
              href="https://digitaladvertisingalliance.org/"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Digital Advertising Alliance
            </a>
          </li>
          <li>
            <a
              href="https://digitaladvertisingalliance.org/blog-terms/daac-digital-advertising-alliance-canada"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Digital Advertising Alliance of Canada
            </a>
          </li>
          <li>
            <a
              href="https://edaa.eu/"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              European Interactive Digital Advertising Alliance
            </a>
          </li>
        </ul>
      </Section>

      <Section title="What about other tracking technologies, like web beacons?">
        <p>
          Cookies are not the only way to recognize or track visitors to a
          website. We may use other, similar technologies from time to time,
          like web beacons (sometimes called &quot;tracking pixels&quot; or
          &quot;clear gifs&quot;). These are tiny graphics files that contain a
          unique identifier that enables us to recognize when someone has
          visited our Website or opened an email including them. This allows us,
          for example, to monitor the traffic patterns of users from one page
          within a website to another, to deliver or communicate with cookies,
          to understand whether you have come to the website from an online
          advertisement displayed on a third-party website, to improve site
          performance, and to measure the success of email marketing campaigns.
          In many instances, these technologies are reliant on cookies to
          function properly, and so declining cookies will impair their
          functioning.
        </p>
      </Section>

      <Section title="Do you use Flash cookies or Local Shared Objects?">
        <p>
          Websites may also use so-called &quot;Flash Cookies&quot; (also known
          as Local Shared Objects or &quot;LSOs&quot;) to, among other things,
          collect and store information about your use of our services, fraud
          prevention, and for other site operations.
        </p>
        <p className="mt-3">
          If you do not want Flash Cookies stored on your computer, you can
          adjust the settings of your Flash player to block Flash Cookies
          storage using the tools contained in the Website Storage Settings
          Panel. You can also control Flash Cookies by going to the Global
          Storage Settings Panel and following the instructions (which may
          include instructions that explain, for example, how to delete existing
          Flash Cookies, how to prevent Flash LSOs from being placed on your
          computer without your being asked, and how to block Flash Cookies that
          are not being delivered by the operator of the page you are on at the
          time).
        </p>
        <p className="mt-3">
          Please note that setting the Flash Player to restrict or limit
          acceptance of Flash Cookies may reduce or impede the functionality of
          some Flash applications, including, potentially, Flash applications
          used in connection with our services or online content.
        </p>
      </Section>

      <Section title="Do you serve targeted advertising?">
        <p>
          Third parties may serve cookies on your computer or mobile device to
          serve advertising through our Website. These companies may use
          information about your visits to this and other websites in order to
          provide relevant advertisements about goods and services that you may
          be interested in. They may also employ technology that is used to
          measure the effectiveness of advertisements. They can accomplish this
          by using cookies or web beacons to collect information about your
          visits to this and other sites in order to provide relevant
          advertisements about goods and services of potential interest to you.
          The information collected through this process does not enable us or
          them to identify your name, contact details, or other details that
          directly identify you unless you choose to provide these.
        </p>
      </Section>

      <Section title="How often will you update this Cookie Policy?">
        <p>
          We may update this Cookie Policy from time to time in order to
          reflect, for example, changes to the cookies we use or for other
          operational, legal, or regulatory reasons. Please therefore revisit
          this Cookie Policy regularly to stay informed about our use of cookies
          and related technologies.
        </p>
        <p className="mt-3">
          The date at the top of this Cookie Policy indicates when it was last
          updated.
        </p>
      </Section>

      <Section title="Where can I get further information?">
        <p>
          If you have any questions about our use of cookies or other
          technologies, please email us at{' '}
          <a href={EMAIL_HREF_JAY} className="text-blue-600 underline">
            {EMAIL_DISPLAY_JAY}
          </a>{' '}
          or by post to:
        </p>
        <address className="not-italic mt-4 space-y-1">
          <p className="font-semibold">Abandoned Hobby</p>
          <p>{BUSINESS_STREET}</p>
          <p>{BUSINESS_CITY_STATE_ZIP}</p>
          <p>{BUSINESS_COUNTRY}</p>
          <p>
            Phone:{' '}
            <a href={PHONE_HREF} className="text-blue-600 underline">
              {PHONE_DISPLAY}
            </a>
          </p>
        </address>
      </Section>
    </div>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-base font-bold text-gray-900 mb-3">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
