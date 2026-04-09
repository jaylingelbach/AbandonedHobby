import type { ReactNode } from 'react';

import Link from 'next/link';

import {
  BUSINESS_CITY_STATE_ZIP,
  BUSINESS_COUNTRY,
  BUSINESS_STREET,
  SUPPORT_EMAIL_DISPLAY,
  SUPPORT_EMAIL_HREF
} from '@/constants';

/**
 * Render the site's Privacy Policy page.
 *
 * Renders a static, fully composed Privacy Policy as a React element with structured sections, a table of contents, internal and external links, and contact information populated from shared constants.
 *
 * @returns A JSX element containing the complete Privacy Policy content and layout.
 */
export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-gray-700 leading-relaxed">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">PRIVACY POLICY</h1>
      <p className="text-gray-500 mb-8">
        <strong>Last updated</strong> April 07, 2026
      </p>

      <Section>
        <p>
          This Privacy Notice for Abandoned Hobby (&quot;we,&quot;
          &quot;us,&quot; or &quot;our&quot;) describes how and why we might
          access, collect, store, use, and/or share (&quot;process&quot;) your
          personal information when you use our services (&quot;Services&quot;),
          including when you:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>
            Visit our website at{' '}
            <a
              href="https://www.abandonedhobby.com"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.abandonedhobby.com
            </a>{' '}
            or any website of ours that links to this Privacy Notice
          </li>
          <li>
            Engage with us in other related ways, including any marketing or
            events
          </li>
        </ul>
        <p className="mt-3">
          <strong>Questions or concerns?</strong> Reading this Privacy Notice
          will help you understand your privacy rights and choices. We are
          responsible for making decisions about how your personal information
          is processed. If you do not agree with our policies and practices,
          please do not use our Services. If you still have any questions or
          concerns, please contact us at{' '}
          <a href={SUPPORT_EMAIL_HREF} className="text-blue-600 underline">
            {SUPPORT_EMAIL_DISPLAY}
          </a>
          .
        </p>
      </Section>

      <Section title="SUMMARY OF KEY POINTS">
        <p className="italic mb-3">
          This summary provides key points from our Privacy Notice, but you can
          find out more details about any of these topics by clicking the link
          following each key point or by using our table of contents below to
          find the section you are looking for.
        </p>
        <div className="space-y-3">
          <p>
            <strong>What personal information do we process?</strong> When you
            visit, use, or navigate our Services, we may process personal
            information depending on how you interact with us and the Services,
            the choices you make, and the products and features you use.{' '}
            <a href="#collect" className="text-blue-600 underline">
              Learn more about personal information you disclose to us.
            </a>
          </p>
          <p>
            <strong>Do we process any sensitive personal information?</strong>{' '}
            Some of the information may be considered &quot;special&quot; or
            &quot;sensitive&quot; in certain jurisdictions. We do not process
            sensitive personal information.
          </p>
          <p>
            <strong>Do we collect any information from third parties?</strong>{' '}
            We do not collect any information from third parties.
          </p>
          <p>
            <strong>How do we process your information?</strong> We process your
            information to provide, improve, and administer our Services,
            communicate with you, for security and fraud prevention, and to
            comply with law.{' '}
            <a href="#process" className="text-blue-600 underline">
              Learn more about how we process your information.
            </a>
          </p>
          <p>
            <strong>
              In what situations and with which parties do we share personal
              information?
            </strong>{' '}
            We may share information in specific situations and with specific
            third parties.{' '}
            <a href="#share" className="text-blue-600 underline">
              Learn more about when and with whom we share your personal
              information.
            </a>
          </p>
          <p>
            <strong>How do we keep your information safe?</strong> We have
            adequate organizational and technical processes and procedures in
            place to protect your personal information. However, no electronic
            transmission over the internet or information storage technology can
            be guaranteed to be 100% secure.{' '}
            <a href="#safe" className="text-blue-600 underline">
              Learn more about how we keep your information safe.
            </a>
          </p>
          <p>
            <strong>What are your rights?</strong> Depending on where you are
            located geographically, the applicable privacy law may mean you have
            certain rights regarding your personal information.{' '}
            <a href="#rights" className="text-blue-600 underline">
              Learn more about your privacy rights.
            </a>
          </p>
          <p>
            <strong>How do you exercise your rights?</strong> The easiest way to
            exercise your rights is by submitting a data subject access request,
            or by contacting us. We will consider and act upon any request in
            accordance with applicable data protection laws.
          </p>
          <p>
            Want to learn more about what we do with any information we collect?
            Review the Privacy Notice in full.
          </p>
        </div>
      </Section>

      <Section title="TABLE OF CONTENTS">
        <ol className="list-decimal list-inside space-y-1">
          {[
            ['#collect', 'WHAT INFORMATION DO WE COLLECT?'],
            ['#process', 'HOW DO WE PROCESS YOUR INFORMATION?'],
            [
              '#share',
              'WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?'
            ],
            ['#cookies', 'DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?'],
            ['#retention', 'HOW LONG DO WE KEEP YOUR INFORMATION?'],
            ['#safe', 'HOW DO WE KEEP YOUR INFORMATION SAFE?'],
            ['#minors', 'DO WE COLLECT INFORMATION FROM MINORS?'],
            ['#rights', 'WHAT ARE YOUR PRIVACY RIGHTS?'],
            ['#dnt', 'CONTROLS FOR DO-NOT-TRACK FEATURES'],
            [
              '#usrights',
              'DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?'
            ],
            ['#updates', 'DO WE MAKE UPDATES TO THIS NOTICE?'],
            ['#contact', 'HOW CAN YOU CONTACT US ABOUT THIS NOTICE?'],
            [
              '#delete',
              'HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?'
            ]
          ].map(([href, label]) => (
            <li key={href}>
              <a href={href} className="text-blue-600 underline">
                {label}
              </a>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="collect" number={1} title="WHAT INFORMATION DO WE COLLECT?">
        <Subsection title="Personal information you disclose to us">
          <p className="italic mb-2">
            In Short: We collect personal information that you provide to us.
          </p>
          <p>
            We collect personal information that you voluntarily provide to us
            when you register on the Services, express an interest in obtaining
            information about us or our products and Services, when you
            participate in activities on the Services, or otherwise when you
            contact us.
          </p>
          <p className="mt-3">
            <strong>Personal Information Provided by You.</strong> The personal
            information that we collect depends on the context of your
            interactions with us and the Services, the choices you make, and the
            products and features you use. The personal information we collect
            may include the following:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
            <li>names</li>
            <li>phone numbers</li>
            <li>email addresses</li>
            <li>mailing addresses</li>
            <li>usernames</li>
            <li>contact preferences</li>
          </ul>
          <p className="mt-3">
            <strong>Sensitive Information.</strong> We do not process sensitive
            information.
          </p>
          <p className="mt-3">
            <strong>Payment Data.</strong> We may collect data necessary to
            process your payment if you choose to make purchases, such as your
            payment instrument number, and the security code associated with
            your payment instrument. All payment data is handled and stored by
            Stripe. You may find their privacy notice link(s) here:{' '}
            <a
              href="https://stripe.com/privacy"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://stripe.com/privacy
            </a>
            .
          </p>
          <p className="mt-3">
            All personal information that you provide to us must be true,
            complete, and accurate, and you must notify us of any changes to
            such personal information.
          </p>
        </Subsection>

        <Subsection title="Information automatically collected">
          <p className="italic mb-2">
            In Short: Some information — such as your Internet Protocol (IP)
            address and/or browser and device characteristics — is collected
            automatically when you visit our Services.
          </p>
          <p>
            We automatically collect certain information when you visit, use, or
            navigate the Services. This information does not reveal your
            specific identity (like your name or contact information) but may
            include device and usage information, such as your IP address,
            browser and device characteristics, operating system, language
            preferences, referring URLs, device name, country, location,
            information about how and when you use our Services, and other
            technical information. This information is primarily needed to
            maintain the security and operation of our Services, and for our
            internal analytics and reporting purposes.
          </p>
          <p className="mt-3">
            Like many businesses, we also collect information through cookies
            and similar technologies.
          </p>
          <p className="mt-3">The information we collect includes:</p>
          <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
            <li>
              <strong>Log and Usage Data.</strong> Log and usage data is
              service-related, diagnostic, usage, and performance information
              our servers automatically collect when you access or use our
              Services and which we record in log files. Depending on how you
              interact with us, this log data may include your IP address,
              device information, browser type, and settings and information
              about your activity in the Services (such as the date/time stamps
              associated with your usage, pages and files viewed, searches, and
              other actions you take such as which features you use), device
              event information (such as system activity, error reports, and
              hardware settings).
            </li>
            <li>
              <strong>Device Data.</strong> We collect device data such as
              information about your computer, phone, tablet, or other device
              you use to access the Services. Depending on the device used, this
              device data may include information such as your IP address (or
              proxy server), device and application identification numbers,
              location, browser type, hardware model, Internet service provider
              and/or mobile carrier, operating system, and system configuration
              information.
            </li>
            <li>
              <strong>Location Data.</strong> We collect location data such as
              information about your device&apos;s location, which can be either
              precise or imprecise. How much information we collect depends on
              the type and settings of the device you use to access the
              Services. You can opt out of allowing us to collect this
              information either by refusing access to the information or by
              disabling your Location setting on your device. However, if you
              choose to opt out, you may not be able to use certain aspects of
              the Services.
            </li>
          </ul>
        </Subsection>
      </Section>

      <Section
        id="process"
        number={2}
        title="HOW DO WE PROCESS YOUR INFORMATION?"
      >
        <p className="italic mb-2">
          In Short: We process your information to provide, improve, and
          administer our Services, communicate with you, for security and fraud
          prevention, and to comply with law. We may also process your
          information for other purposes with your consent.
        </p>
        <p>
          We process your personal information for a variety of reasons,
          depending on how you interact with our Services, including:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
          <li>
            <strong>
              To facilitate account creation and authentication and otherwise
              manage user accounts.
            </strong>{' '}
            We may process your information so you can create and log in to your
            account, as well as keep your account in working order.
          </li>
          <li>
            <strong>To fulfill and manage your orders.</strong> We may process
            your information to fulfill and manage your orders, payments,
            returns, and exchanges made through the Services.
          </li>
          <li>
            <strong>
              To evaluate and improve our Services, products, marketing, and
              your experience.
            </strong>{' '}
            We may process your information when we believe it is necessary to
            identify usage trends, determine the effectiveness of our
            promotional campaigns, and to evaluate and improve our Services,
            products, marketing, and your experience.
          </li>
          <li>
            <strong>To identify usage trends.</strong> We may process
            information about how you use our Services to better understand how
            they are being used so we can improve them.
          </li>
        </ul>
      </Section>

      <Section
        id="share"
        number={3}
        title="WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?"
      >
        <p className="italic mb-2">
          In Short: We may share information in specific situations described in
          this section and/or with the following third parties.
        </p>
        <p>
          We may need to share your personal information in the following
          situations:
        </p>
        <ul className="list-disc list-inside mt-2 ml-4">
          <li>
            <strong>Business Transfers.</strong> We may share or transfer your
            information in connection with, or during negotiations of, any
            merger, sale of company assets, financing, or acquisition of all or
            a portion of our business to another company.
          </li>
        </ul>
      </Section>

      <Section
        id="cookies"
        number={4}
        title="DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?"
      >
        <p className="italic mb-2">
          In Short: We may use cookies and other tracking technologies to
          collect and store your information.
        </p>
        <p>
          We may use cookies and similar tracking technologies (like web beacons
          and pixels) to gather information when you interact with our Services.
          Some online tracking technologies help us maintain the security of our
          Services and your account, prevent crashes, fix bugs, save your
          preferences, and assist with basic site functions.
        </p>
        <p className="mt-3">
          We also permit third parties and service providers to use online
          tracking technologies on our Services for analytics and advertising,
          including to help manage and display advertisements, to tailor
          advertisements to your interests, or to send abandoned shopping cart
          reminders (depending on your communication preferences).
        </p>
        <p className="mt-3">
          To the extent these online tracking technologies are deemed to be a
          &quot;sale&quot;/&quot;sharing&quot; (which includes targeted
          advertising, as defined under applicable US state laws) under
          applicable US state laws, you can opt out of these online tracking
          technologies by submitting a request as described below under section
          &quot;DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?&quot;
        </p>
        <p className="mt-3">
          Specific information about how we use such technologies and how you
          can refuse certain cookies is set out in our{' '}
          <Link href="/cookies" className="text-blue-600 underline">
            Cookie Policy
          </Link>
          .
        </p>
      </Section>

      <Section
        id="retention"
        number={5}
        title="HOW LONG DO WE KEEP YOUR INFORMATION?"
      >
        <p className="italic mb-2">
          In Short: We keep your information for as long as necessary to fulfill
          the purposes outlined in this Privacy Notice unless otherwise required
          by law.
        </p>
        <p>
          We will only keep your personal information for as long as it is
          necessary for the purposes set out in this Privacy Notice, unless a
          longer retention period is required or permitted by law (such as tax,
          accounting, or other legal requirements). No purpose in this notice
          will require us keeping your personal information for longer than
          three (3) months past the termination of the user&apos;s account.
        </p>
        <p className="mt-3">
          When we have no ongoing legitimate business need to process your
          personal information, we will either delete or anonymize such
          information, or, if this is not possible (for example, because your
          personal information has been stored in backup archives), then we will
          securely store your personal information and isolate it from any
          further processing until deletion is possible.
        </p>
      </Section>

      <Section
        id="safe"
        number={6}
        title="HOW DO WE KEEP YOUR INFORMATION SAFE?"
      >
        <p className="italic mb-2">
          In Short: We aim to protect your personal information through a system
          of organizational and technical security measures.
        </p>
        <p>
          We have implemented appropriate and reasonable technical and
          organizational security measures designed to protect the security of
          any personal information we process. However, despite our safeguards
          and efforts to secure your information, no electronic transmission
          over the Internet or information storage technology can be guaranteed
          to be 100% secure, so we cannot promise or guarantee that hackers,
          cybercriminals, or other unauthorized third parties will not be able
          to defeat our security and improperly collect, access, steal, or
          modify your information. Although we will do our best to protect your
          personal information, transmission of personal information to and from
          our Services is at your own risk. You should only access the Services
          within a secure environment.
        </p>
      </Section>

      <Section
        id="minors"
        number={7}
        title="DO WE COLLECT INFORMATION FROM MINORS?"
      >
        <p className="italic mb-2">
          In Short: We do not knowingly collect data from or market to children
          under 18 years of age.
        </p>
        <p>
          We do not knowingly collect, solicit data from, or market to children
          under 18 years of age, nor do we knowingly sell such personal
          information. By using the Services, you represent that you are at
          least 18 or that you are the parent or guardian of such a minor and
          consent to such minor dependent&apos;s use of the Services. If we
          learn that personal information from users less than 18 years of age
          has been collected, we will deactivate the account and take reasonable
          measures to promptly delete such data from our records. If you become
          aware of any data we may have collected from children under age 18,
          please contact us at{' '}
          <a href={SUPPORT_EMAIL_HREF} className="text-blue-600 underline">
            {SUPPORT_EMAIL_DISPLAY}
          </a>
          .
        </p>
      </Section>

      <Section id="rights" number={8} title="WHAT ARE YOUR PRIVACY RIGHTS?">
        <p className="italic mb-2">
          In Short: You may review, change, or terminate your account at any
          time, depending on your country, province, or state of residence.
        </p>
        <p>
          <strong>Withdrawing your consent:</strong> If we are relying on your
          consent to process your personal information, which may be express
          and/or implied consent depending on the applicable law, you have the
          right to withdraw your consent at any time. You can withdraw your
          consent at any time by contacting us by using the contact details
          provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS
          NOTICE?&quot; below.
        </p>
        <p className="mt-3">
          However, please note that this will not affect the lawfulness of the
          processing before its withdrawal nor, when applicable law allows, will
          it affect the processing of your personal information conducted in
          reliance on lawful processing grounds other than consent.
        </p>

        <Subsection title="Account Information">
          <p>
            If you would at any time like to review or change the information in
            your account or terminate your account, you can log in to your
            account settings and update your user account.
          </p>
          <p className="mt-3">
            Upon your request to terminate your account, we will deactivate or
            delete your account and information from our active databases.
            However, we may retain some information in our files to prevent
            fraud, troubleshoot problems, assist with any investigations,
            enforce our legal terms and/or comply with applicable legal
            requirements.
          </p>
        </Subsection>

        <p className="mt-4">
          <strong>Cookies and similar technologies:</strong> Most Web browsers
          are set to accept cookies by default. If you prefer, you can usually
          choose to set your browser to remove cookies and to reject cookies. If
          you choose to remove cookies or reject cookies, this could affect
          certain features or services of our Services.
        </p>
        <p className="mt-3">
          If you have questions or comments about your privacy rights, you may
          email us at{' '}
          <a href={SUPPORT_EMAIL_HREF} className="text-blue-600 underline">
            {SUPPORT_EMAIL_DISPLAY}
          </a>
          .
        </p>
      </Section>

      <Section id="dnt" number={9} title="CONTROLS FOR DO-NOT-TRACK FEATURES">
        <p>
          Most web browsers and some mobile operating systems and mobile
          applications include a Do-Not-Track (&quot;DNT&quot;) feature or
          setting you can activate to signal your privacy preference not to have
          data about your online browsing activities monitored and collected. At
          this stage, no uniform technology standard for recognizing and
          implementing DNT signals has been finalized. As such, we do not
          currently respond to DNT browser signals or any other mechanism that
          automatically communicates your choice not to be tracked online. If a
          standard for online tracking is adopted that we must follow in the
          future, we will inform you about that practice in a revised version of
          this Privacy Notice.
        </p>
        <p className="mt-3">
          California law requires us to let you know how we respond to web
          browser DNT signals. Because there currently is not an industry or
          legal standard for recognizing or honoring DNT signals, we do not
          respond to them at this time.
        </p>
      </Section>

      <Section
        id="usrights"
        number={10}
        title="DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?"
      >
        <p className="italic mb-2">
          In Short: If you are a resident of California, Colorado, Connecticut,
          Delaware, Florida, Indiana, Iowa, Kentucky, Maryland, Minnesota,
          Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island,
          Tennessee, Texas, Utah, or Virginia, you may have the right to request
          access to and receive details about the personal information we
          maintain about you and how we have processed it, correct inaccuracies,
          get a copy of, or delete your personal information.
        </p>

        <Subsection title="Categories of Personal Information We Collect">
          <p className="mb-3">
            The table below shows the categories of personal information we have
            collected in the past twelve (12) months.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th
                    scope="col"
                    className="border border-gray-300 px-3 py-2 text-left"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="border border-gray-300 px-3 py-2 text-left"
                  >
                    Examples
                  </th>
                  <th
                    scope="col"
                    className="border border-gray-300 px-3 py-2 text-center"
                  >
                    Collected
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    'A. Identifiers',
                    'Contact details, such as real name, alias, postal address, telephone or mobile contact number, unique personal identifier, online identifier, Internet Protocol address, email address, and account name',
                    'YES'
                  ],
                  [
                    'B. Personal information as defined in the California Customer Records statute',
                    'Name, contact information, education, employment, employment history, and financial information',
                    'YES'
                  ],
                  [
                    'C. Protected classification characteristics under state or federal law',
                    'Gender, age, date of birth, race and ethnicity, national origin, marital status, and other demographic data',
                    'NO'
                  ],
                  [
                    'D. Commercial information',
                    'Transaction information, purchase history, financial details, and payment information',
                    'YES'
                  ],
                  [
                    'E. Biometric information',
                    'Fingerprints and voiceprints',
                    'NO'
                  ],
                  [
                    'F. Internet or other similar network activity',
                    'Browsing history, search history, online behavior, interest data, and interactions with our and other websites, applications, systems, and advertisements',
                    'YES'
                  ],
                  ['G. Geolocation data', 'Device location', 'YES'],
                  [
                    'H. Audio, electronic, sensory, or similar information',
                    'Images and audio, video or call recordings created in connection with our business activities',
                    'NO'
                  ],
                  [
                    'I. Professional or employment-related information',
                    'Business contact details in order to provide you our Services at a business level or job title, work history, and professional qualifications if you apply for a job with us',
                    'NO'
                  ],
                  [
                    'J. Education Information',
                    'Student records and directory information',
                    'NO'
                  ],
                  [
                    'K. Inferences drawn from collected personal information',
                    "Inferences drawn from any of the collected personal information listed above to create a profile or summary about, for example, an individual's preferences and characteristics",
                    'NO'
                  ],
                  ['L. Sensitive personal information', '', 'NO']
                ].map(([category, examples, collected]) => (
                  <tr key={category}>
                    <td className="border border-gray-300 px-3 py-2 align-top">
                      {category}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 align-top">
                      {examples}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center align-top font-medium">
                      {collected}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            We may also collect other personal information outside of these
            categories through instances where you interact with us in person,
            online, or by phone or mail in the context of:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
            <li>Receiving help through our customer support channels;</li>
            <li>Participation in customer surveys or contests; and</li>
            <li>
              Facilitation in the delivery of our Services and to respond to
              your inquiries.
            </li>
          </ul>
        </Subsection>

        <Subsection title="Sources of Personal Information">
          <p>
            Learn more about the sources of personal information we collect in
            &quot;WHAT INFORMATION DO WE COLLECT?&quot;
          </p>
        </Subsection>

        <Subsection title="How We Use and Share Personal Information">
          <p>
            Your personal information may be used in profiling and automated
            processes that could produce legal or similarly significant effects
            for you. Learn more about how we use your personal information in
            the section &quot;HOW DO WE PROCESS YOUR INFORMATION?&quot;
          </p>
          <p className="mt-3">
            <strong>Will your information be shared with anyone else?</strong>
          </p>
          <p className="mt-2">
            We may disclose your personal information with our service providers
            pursuant to a written contract between us and each service provider.
            Learn more about how we disclose personal information in the section
            &quot;WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL
            INFORMATION?&quot;
          </p>
          <p className="mt-3">
            We may use your personal information for our own business purposes,
            such as for undertaking internal research for technological
            development and demonstration. This is not considered to be
            &quot;selling&quot; of your personal information.
          </p>
          <p className="mt-3">
            We have not disclosed, sold, or shared any personal information to
            third parties for a business or commercial purpose in the preceding
            twelve (12) months. We will not sell or share personal information
            in the future belonging to website visitors, users, and other
            consumers.
          </p>
        </Subsection>

        <Subsection title="Your Rights">
          <p>
            You have rights under certain US state data protection laws.
            However, these rights are not absolute, and in certain cases, we may
            decline your request as permitted by law. These rights include:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
            <li>
              Right to know whether or not we are processing your personal data
            </li>
            <li>Right to access your personal data</li>
            <li>Right to correct inaccuracies in your personal data</li>
            <li>Right to request the deletion of your personal data</li>
            <li>
              Right to obtain a copy of the personal data you previously shared
              with us
            </li>
            <li>Right to non-discrimination for exercising your rights</li>
            <li>
              Right to opt out of the processing of your personal data if it is
              used for targeted advertising, the sale of personal data, or
              profiling in furtherance of decisions that produce legal or
              similarly significant effects
            </li>
          </ul>
          <p className="mt-3">
            Depending upon the state where you live, you may also have the
            following rights:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
            <li>
              Right to access the categories of personal data being processed
            </li>
            <li>
              Right to obtain a list of the categories of third parties to which
              we have disclosed personal data
            </li>
            <li>
              Right to obtain a list of specific third parties to which we have
              disclosed personal data
            </li>
            <li>
              Right to obtain a list of third parties to which we have sold
              personal data
            </li>
            <li>
              Right to review, understand, question, and correct how personal
              data has been profiled
            </li>
            <li>
              Right to limit use and disclosure of sensitive personal data
            </li>
            <li>
              Right to opt out of the collection of sensitive data and personal
              data collected through the operation of a voice or facial
              recognition feature
            </li>
          </ul>
        </Subsection>

        <Subsection title="How to Exercise Your Rights">
          <p>
            To exercise these rights, you can contact us by submitting a data
            subject access request, by emailing us at{' '}
            <a href={SUPPORT_EMAIL_HREF} className="text-blue-600 underline">
              {SUPPORT_EMAIL_DISPLAY}
            </a>
            , or by referring to the contact details at the bottom of this
            document.
          </p>
          <p className="mt-3">
            Under certain US state data protection laws, you can designate an
            authorized agent to make a request on your behalf. We may deny a
            request from an authorized agent that does not submit proof that
            they have been validly authorized to act on your behalf in
            accordance with applicable laws.
          </p>
        </Subsection>

        <Subsection title="Request Verification">
          <p>
            Upon receiving your request, we will need to verify your identity to
            determine you are the same person about whom we have the information
            in our system. We will only use personal information provided in
            your request to verify your identity or authority to make the
            request. However, if we cannot verify your identity from the
            information already maintained by us, we may request that you
            provide additional information for the purposes of verifying your
            identity and for security or fraud-prevention purposes.
          </p>
          <p className="mt-3">
            If you submit the request through an authorized agent, we may need
            to collect additional information to verify your identity before
            processing your request and the agent will need to provide a written
            and signed permission from you to submit such request on your
            behalf.
          </p>
        </Subsection>

        <Subsection title="Appeals">
          <p>
            Under certain US state data protection laws, if we decline to take
            action regarding your request, you may appeal our decision by
            emailing us at{' '}
            <a href={SUPPORT_EMAIL_HREF} className="text-blue-600 underline">
              {SUPPORT_EMAIL_DISPLAY}
            </a>
            . We will inform you in writing of any action taken or not taken in
            response to the appeal, including a written explanation of the
            reasons for the decisions. If your appeal is denied, you may submit
            a complaint to your state attorney general.
          </p>
        </Subsection>

        <Subsection title='California "Shine The Light" Law'>
          <p>
            California Civil Code Section 1798.83, also known as the &quot;Shine
            The Light&quot; law, permits our users who are California residents
            to request and obtain from us, once a year and free of charge,
            information about categories of personal information (if any) we
            disclosed to third parties for direct marketing purposes and the
            names and addresses of all third parties with which we shared
            personal information in the immediately preceding calendar year. If
            you are a California resident and would like to make such a request,
            please submit your request in writing to us by using the contact
            details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT
            THIS NOTICE?&quot;
          </p>
        </Subsection>
      </Section>

      <Section
        id="updates"
        number={11}
        title="DO WE MAKE UPDATES TO THIS NOTICE?"
      >
        <p className="italic mb-2">
          In Short: Yes, we will update this notice as necessary to stay
          compliant with relevant laws.
        </p>
        <p>
          We may update this Privacy Notice from time to time. The updated
          version will be indicated by an updated &quot;Revised&quot; date at
          the top of this Privacy Notice. If we make material changes to this
          Privacy Notice, we may notify you either by prominently posting a
          notice of such changes or by directly sending you a notification. We
          encourage you to review this Privacy Notice frequently to be informed
          of how we are protecting your information.
        </p>
      </Section>

      <Section
        id="contact"
        number={12}
        title="HOW CAN YOU CONTACT US ABOUT THIS NOTICE?"
      >
        <p>
          If you have questions or comments about this notice, you may email us
          at{' '}
          <a href={SUPPORT_EMAIL_HREF} className="text-blue-600 underline">
            {SUPPORT_EMAIL_DISPLAY}
          </a>{' '}
          or contact us by post at:
        </p>
        <address className="not-italic mt-4 space-y-1">
          <p className="font-semibold">Abandoned Hobby</p>
          <p>{BUSINESS_STREET}</p>
          <p>{BUSINESS_CITY_STATE_ZIP}</p>
          <p>{BUSINESS_COUNTRY}</p>
        </address>
      </Section>

      <Section
        id="delete"
        number={13}
        title="HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?"
      >
        <p>
          Based on the applicable laws of your country or state of residence in
          the US, you may have the right to request access to the personal
          information we collect from you, details about how we have processed
          it, correct inaccuracies, or delete your personal information. You may
          also have the right to withdraw your consent to our processing of your
          personal information. These rights may be limited in some
          circumstances by applicable law. To request to review, update, or
          delete your personal information, please fill out and submit a data
          subject access request.
        </p>
      </Section>
    </div>
  );
}

/**
 * Render a document section with an optional numbered heading.
 *
 * When `title` is provided the component renders a section element containing an `<h2>` heading
 * (prefixed with `number` if present) and the `children`. When `title` is omitted it renders a
 * plain section containing only the `children` (no heading or `id`).
 *
 * @param id - Optional id applied to the section element when a `title` is present (used for in-page anchors)
 * @param number - Optional numeric prefix for the heading; when provided the heading will be prefixed with "`<number>. `"
 * @param title - Optional heading text for the section; if omitted the section renders without a heading
 * @param children - The content to render inside the section
 */
function Section({
  id,
  number,
  title,
  children
}: {
  id?: string;
  number?: number;
  title?: string;
  children: ReactNode;
}) {
  if (!title) {
    return <section className="mt-6">{children}</section>;
  }
  return (
    <section id={id} className="mt-10">
      <h2 className="text-base font-bold text-gray-900 uppercase mb-3">
        {number != null ? `${number}. ` : ''}
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

/**
 * Renders a subsection block with a heading followed by provided content.
 *
 * @param title - The subsection heading text displayed in an <h3>.
 * @param children - Content rendered below the heading.
 * @returns A <div> containing an <h3> title and the provided children.
 */
function Subsection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}
