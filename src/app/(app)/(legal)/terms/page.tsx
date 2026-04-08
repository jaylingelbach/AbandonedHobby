import { ReactNode } from 'react';

import {
  BUSINESS_ADDRESS,
  BUSINESS_CITY_STATE_ZIP,
  BUSINESS_COUNTRY,
  BUSINESS_STREET,
  EMAIL_DISPLAY_JAY,
  EMAIL_HREF_JAY,
  PHONE_DISPLAY,
  PHONE_HREF,
  SUPPORT_EMAIL_DISPLAY,
  SUPPORT_EMAIL_HREF
} from '@/constants';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-gray-700 leading-relaxed">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">
        TERMS OF SERVICE
      </h1>
      <p className="text-gray-500 mb-8">
        <strong>Last updated</strong> April 07, 2026
      </p>

      <Section title="AGREEMENT TO OUR LEGAL TERMS">
        <p>
          We are <strong>Abandoned Hobby</strong> (&quot;Company,&quot;
          &quot;we,&quot; &quot;us,&quot; &quot;our&quot;), a company registered
          in Illinois, {BUSINESS_COUNTRY} at {BUSINESS_ADDRESS}.
        </p>
        <p className="mt-3">
          We operate the website{' '}
          <a
            href="https://www.abandonedhobby.com"
            className="text-blue-600 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://www.abandonedhobby.com
          </a>{' '}
          (the &quot;Site&quot;), as well as any other related products and
          services that refer or link to these legal terms (the &quot;Legal
          Terms&quot;) (collectively, the &quot;Services&quot;).
        </p>
        <p className="mt-3">
          Abandoned Hobby is an online marketplace that allows users to buy and
          sell hobby-related items. Sellers can create listings for items they
          no longer use, and buyers can browse, purchase, and communicate with
          sellers through the platform. Payments are processed through a
          third-party provider, and users are responsible for fulfilling
          transactions and shipping items. The platform also includes messaging
          features to facilitate communication between buyers and sellers.
        </p>
        <p className="mt-3">
          You can contact us by phone at{' '}
          <a href={PHONE_HREF} className="text-blue-600 underline">
            {PHONE_DISPLAY}
          </a>
          , email at{' '}
          <a href={EMAIL_HREF_JAY} className="text-blue-600 underline">
            {EMAIL_DISPLAY_JAY}
          </a>
          , or by mail to {BUSINESS_ADDRESS}
        </p>
        <p className="mt-3">
          These Legal Terms constitute a legally binding agreement made between
          you, whether personally or on behalf of an entity (&quot;you&quot;),
          and Abandoned Hobby, concerning your access to and use of the
          Services. You agree that by accessing the Services, you have read,
          understood, and agreed to be bound by all of these Legal Terms.{' '}
          <strong>
            IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE
            EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST
            DISCONTINUE USE IMMEDIATELY.
          </strong>
        </p>
        <p className="mt-3">
          We will provide you with prior notice of any scheduled changes to the
          Services you are using. The modified Legal Terms will become effective
          upon posting or notifying you by{' '}
          <a href={SUPPORT_EMAIL_HREF} className="text-blue-600 underline">
            {SUPPORT_EMAIL_DISPLAY}
          </a>
          , as stated in the email message. By continuing to use the Services
          after the effective date of any changes, you agree to be bound by the
          modified terms.
        </p>
        <p className="mt-3">
          The Services are intended for users who are at least 18 years old.
          Persons under the age of 18 are not permitted to use or register for
          the Services.
        </p>
        <p className="mt-3">
          We recommend that you print a copy of these Legal Terms for your
          records.
        </p>
      </Section>

      <Section title="TABLE OF CONTENTS">
        <ol className="list-decimal list-inside space-y-1">
          {[
            ['#services', 'OUR SERVICES'],
            ['#ip', 'INTELLECTUAL PROPERTY RIGHTS'],
            ['#userreps', 'USER REPRESENTATIONS'],
            ['#userreg', 'USER REGISTRATION'],
            ['#products', 'PRODUCTS'],
            ['#purchases', 'PURCHASES AND PAYMENT'],
            ['#return', 'RETURN POLICY'],
            ['#prohibited', 'PROHIBITED ACTIVITIES'],
            ['#ugc', 'USER GENERATED CONTRIBUTIONS'],
            ['#license', 'CONTRIBUTION LICENSE'],
            ['#reviews', 'GUIDELINES FOR REVIEWS'],
            ['#advertisers', 'ADVERTISERS'],
            ['#sitemanage', 'SERVICES MANAGEMENT'],
            ['#privacy', 'PRIVACY POLICY'],
            [
              '#dmca',
              'DIGITAL MILLENNIUM COPYRIGHT ACT (DMCA) NOTICE AND POLICY'
            ],
            ['#termination', 'TERM AND TERMINATION'],
            ['#modifications', 'MODIFICATIONS AND INTERRUPTIONS'],
            ['#law', 'GOVERNING LAW'],
            ['#disputes', 'DISPUTE RESOLUTION'],
            ['#corrections', 'CORRECTIONS'],
            ['#disclaimer', 'DISCLAIMER'],
            ['#liability', 'LIMITATIONS OF LIABILITY'],
            ['#indemnification', 'INDEMNIFICATION'],
            ['#userdata', 'USER DATA'],
            [
              '#electronic',
              'ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES'
            ],
            ['#california', 'CALIFORNIA USERS AND RESIDENTS'],
            ['#misc', 'MISCELLANEOUS'],
            ['#contact', 'CONTACT US']
          ].map(([href, label]) => (
            <li key={href}>
              <a href={href} className="text-blue-600 underline">
                {label}
              </a>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="services" number={1} title="OUR SERVICES">
        <p>
          The information provided when using the Services is not intended for
          distribution to or use by any person or entity in any jurisdiction or
          country where such distribution or use would be contrary to law or
          regulation or which would subject us to any registration requirement
          within such jurisdiction or country. Accordingly, those persons who
          choose to access the Services from other locations do so on their own
          initiative and are solely responsible for compliance with local laws,
          if and to the extent local laws are applicable.
        </p>
        <p className="mt-3">
          The Services are not tailored to comply with industry-specific
          regulations (Health Insurance Portability and Accountability Act
          (HIPAA), Federal Information Security Management Act (FISMA), etc.),
          so if your interactions would be subjected to such laws, you may not
          use the Services. You may not use the Services in a way that would
          violate the Gramm-Leach-Bliley Act (GLBA).
        </p>
      </Section>

      <Section id="ip" number={2} title="INTELLECTUAL PROPERTY RIGHTS">
        <Subsection title="Our intellectual property">
          <p>
            We are the owner or the licensee of all intellectual property rights
            in our Services, including all source code, databases,
            functionality, software, website designs, audio, video, text,
            photographs, and graphics in the Services (collectively, the
            &quot;Content&quot;), as well as the trademarks, service marks, and
            logos contained therein (the &quot;Marks&quot;).
          </p>
          <p className="mt-3">
            Our Content and Marks are protected by copyright and trademark laws
            (and various other intellectual property rights and unfair
            competition laws) and treaties in the United States and around the
            world.
          </p>
          <p className="mt-3">
            The Content and Marks are provided in or through the Services
            &quot;AS IS&quot; for your personal, non-commercial use only.
          </p>
        </Subsection>

        <Subsection title="Your use of our Services">
          <p>
            Subject to your compliance with these Legal Terms, including the{' '}
            <a href="#prohibited" className="text-blue-600 underline">
              PROHIBITED ACTIVITIES
            </a>{' '}
            section below, we grant you a non-exclusive, non-transferable,
            revocable license to:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
            <li>access the Services; and</li>
            <li>
              download or print a copy of any portion of the Content to which
              you have properly gained access,
            </li>
          </ul>
          <p className="mt-2">solely for your personal, non-commercial use.</p>
          <p className="mt-3">
            Except as set out in this section or elsewhere in our Legal Terms,
            no part of the Services and no Content or Marks may be copied,
            reproduced, aggregated, republished, uploaded, posted, publicly
            displayed, encoded, translated, transmitted, distributed, sold,
            licensed, or otherwise exploited for any commercial purpose
            whatsoever, without our express prior written permission.
          </p>
          <p className="mt-3">
            If you wish to make any use of the Services, Content, or Marks other
            than as set out in this section or elsewhere in our Legal Terms,
            please address your request to:{' '}
            <a href={EMAIL_HREF_JAY} className="text-blue-600 underline">
              {EMAIL_DISPLAY_JAY}
            </a>
            . If we ever grant you the permission to post, reproduce, or
            publicly display any part of our Services or Content, you must
            identify us as the owners or licensors of the Services, Content, or
            Marks and ensure that any copyright or proprietary notice appears or
            is visible on posting, reproducing, or displaying our Content.
          </p>
          <p className="mt-3">
            We reserve all rights not expressly granted to you in and to the
            Services, Content, and Marks.
          </p>
          <p className="mt-3">
            Any breach of these Intellectual Property Rights will constitute a
            material breach of our Legal Terms and your right to use our
            Services will terminate immediately.
          </p>
        </Subsection>

        <Subsection title="Your submissions and contributions">
          <p>
            Please review this section and the{' '}
            <a href="#prohibited" className="text-blue-600 underline">
              PROHIBITED ACTIVITIES
            </a>{' '}
            section carefully prior to using our Services to understand the (a)
            rights you give us and (b) obligations you have when you post or
            upload any content through the Services.
          </p>
          <p className="mt-3">
            <strong>Submissions:</strong> By directly sending us any question,
            comment, suggestion, idea, feedback, or other information about the
            Services (&quot;Submissions&quot;), you agree to assign to us all
            intellectual property rights in such Submission. You agree that we
            shall own this Submission and be entitled to its unrestricted use
            and dissemination for any lawful purpose, commercial or otherwise,
            without acknowledgment or compensation to you.
          </p>
          <p className="mt-3">
            <strong>Contributions:</strong> The Services may invite you to chat,
            contribute to, or participate in blogs, message boards, online
            forums, and other functionality during which you may create, submit,
            post, display, transmit, publish, distribute, or broadcast content
            and materials to us or through the Services, including but not
            limited to text, writings, video, audio, photographs, music,
            graphics, comments, reviews, rating suggestions, personal
            information, or other material (&quot;Contributions&quot;). Any
            Submission that is publicly posted shall also be treated as a
            Contribution.
          </p>
          <p className="mt-3">
            You understand that Contributions may be viewable by other users of
            the Services.
          </p>
          <p className="mt-3">
            <strong>
              When you post Contributions, you grant us a license (including use
              of your name, trademarks, and logos):
            </strong>{' '}
            By posting any Contributions, you grant us an unrestricted,
            unlimited, irrevocable, perpetual, non-exclusive, transferable,
            royalty-free, fully-paid, worldwide right, and license to: use,
            copy, reproduce, distribute, sell, resell, publish, broadcast,
            retitle, store, publicly perform, publicly display, reformat,
            translate, excerpt (in whole or in part), and exploit your
            Contributions (including, without limitation, your image, name, and
            voice) for any purpose, commercial, advertising, or otherwise, to
            prepare derivative works of, or incorporate into other works, your
            Contributions, and to sublicense the licenses granted in this
            section. Our use and distribution may occur in any media formats and
            through any media channels.
          </p>
          <p className="mt-3">
            This license includes our use of your name, company name, and
            franchise name, as applicable, and any of the trademarks, service
            marks, trade names, logos, and personal and commercial images you
            provide.
          </p>
          <p className="mt-3">
            <strong>You are responsible for what you post or upload:</strong> By
            sending us Submissions and/or posting Contributions through any part
            of the Services or making Contributions accessible through the
            Services by linking your account through the Services to any of your
            social networking accounts, you:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
            <li>
              confirm that you have read and agree with our{' '}
              <a href="#prohibited" className="text-blue-600 underline">
                PROHIBITED ACTIVITIES
              </a>{' '}
              and will not post, send, publish, upload, or transmit through the
              Services any Submission nor post any Contribution that is illegal,
              harassing, hateful, harmful, defamatory, obscene, bullying,
              abusive, discriminatory, threatening to any person or group,
              sexually explicit, false, inaccurate, deceitful, or misleading;
            </li>
            <li>
              to the extent permissible by applicable law, waive any and all
              moral rights to any such Submission and/or Contribution;
            </li>
            <li>
              warrant that any such Submission and/or Contributions are original
              to you or that you have the necessary rights and licenses to
              submit such Submissions and/or Contributions and that you have
              full authority to grant us the above-mentioned rights in relation
              to your Submissions and/or Contributions; and
            </li>
            <li>
              warrant and represent that your Submissions and/or Contributions
              do not constitute confidential information.
            </li>
          </ul>
          <p className="mt-3">
            You are solely responsible for your Submissions and/or Contributions
            and you expressly agree to reimburse us for any and all losses that
            we may suffer because of your breach of (a) this section, (b) any
            third party&apos;s intellectual property rights, or (c) applicable
            law.
          </p>
          <p className="mt-3">
            <strong>We may remove or edit your Content:</strong> Although we
            have no obligation to monitor any Contributions, we shall have the
            right to remove or edit any Contributions at any time without notice
            if in our reasonable opinion we consider such Contributions harmful
            or in breach of these Legal Terms. If we remove or edit any such
            Contributions, we may also suspend or disable your account and
            report you to the authorities.
          </p>
        </Subsection>

        <Subsection title="Copyright infringement">
          <p>
            We respect the intellectual property rights of others. If you
            believe that any material available on or through the Services
            infringes upon any copyright you own or control, please immediately
            refer to the{' '}
            <a href="#dmca" className="text-blue-600 underline">
              DIGITAL MILLENNIUM COPYRIGHT ACT (DMCA) NOTICE AND POLICY
            </a>{' '}
            section below.
          </p>
        </Subsection>
      </Section>

      <Section id="userreps" number={3} title="USER REPRESENTATIONS">
        <p>
          By using the Services, you represent and warrant that: (1) all
          registration information you submit will be true, accurate, current,
          and complete; (2) you will maintain the accuracy of such information
          and promptly update such registration information as necessary; (3)
          you have the legal capacity and you agree to comply with these Legal
          Terms; (4) you are not a minor in the jurisdiction in which you
          reside; (5) you will not access the Services through automated or
          non-human means, whether through a bot, script or otherwise; (6) you
          will not use the Services for any illegal or unauthorized purpose; and
          (7) your use of the Services will not violate any applicable law or
          regulation.
        </p>
        <p className="mt-3">
          If you provide any information that is untrue, inaccurate, not
          current, or incomplete, we have the right to suspend or terminate your
          account and refuse any and all current or future use of the Services
          (or any portion thereof).
        </p>
      </Section>

      <Section id="userreg" number={4} title="USER REGISTRATION">
        <p>
          You may be required to register to use the Services. You agree to keep
          your password confidential and will be responsible for all use of your
          account and password. We reserve the right to remove, reclaim, or
          change a username you select if we determine, in our sole discretion,
          that such username is inappropriate, obscene, or otherwise
          objectionable.
        </p>
      </Section>

      <Section id="products" number={5} title="PRODUCTS">
        <p>
          We make every effort to display as accurately as possible the colors,
          features, specifications, and details of the products available on the
          Services. However, we do not guarantee that the colors, features,
          specifications, and details of the products will be accurate,
          complete, reliable, current, or free of other errors, and your
          electronic display may not accurately reflect the actual colors and
          details of the products. All products are subject to availability, and
          we cannot guarantee that items will be in stock. We reserve the right
          to discontinue any products at any time for any reason. Prices for all
          products are subject to change.
        </p>
      </Section>

      <Section id="purchases" number={6} title="PURCHASES AND PAYMENT">
        <p>
          You agree to provide current, complete, and accurate purchase and
          account information for all purchases made via the Services. You
          further agree to promptly update account and payment information,
          including email address, payment method, and payment card expiration
          date, so that we can complete your transactions and contact you as
          needed. Sales tax will be added to the price of purchases as deemed
          required by us. We may change prices at any time. All payments shall
          be in US dollars.
        </p>
        <p className="mt-3">
          You agree to pay all charges at the prices then in effect for your
          purchases and any applicable shipping fees, and you authorize us to
          charge your chosen payment provider for any such amounts upon placing
          your order. We reserve the right to correct any errors or mistakes in
          pricing, even if we have already requested or received payment.
        </p>
        <p className="mt-3">
          We reserve the right to refuse any order placed through the Services.
          We may, in our sole discretion, limit or cancel quantities purchased
          per person, per household, or per order. These restrictions may
          include orders placed by or under the same customer account, the same
          payment method, and/or orders that use the same billing or shipping
          address. We reserve the right to limit or prohibit orders that, in our
          sole judgment, appear to be placed by dealers, resellers, or
          distributors.
        </p>
      </Section>

      <Section id="return" number={7} title="RETURN POLICY">
        <p>
          Please review our Return Policy prior to making any purchases:{' '}
          <a
            href="https://abandonedhobby.com/support#buyers"
            className="text-blue-600 underline"
          >
            https://abandonedhobby.com/support#buyers
          </a>
          .
        </p>
      </Section>

      <Section id="prohibited" number={8} title="PROHIBITED ACTIVITIES">
        <p>
          You may not access or use the Services for any purpose other than that
          for which we make the Services available. The Services may not be used
          in connection with any commercial endeavors except those that are
          specifically endorsed or approved by us.
        </p>
        <p className="mt-3">As a user of the Services, you agree not to:</p>
        <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
          {[
            'Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.',
            'Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.',
            'Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein.',
            'Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.',
            'Use any information obtained from the Services in order to harass, abuse, or harm another person.',
            'Make improper use of our support services or submit false reports of abuse or misconduct.',
            'Use the Services in a manner inconsistent with any applicable laws or regulations.',
            'Engage in unauthorized framing of or linking to the Services.',
            "Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party's uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.",
            'Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.',
            'Delete the copyright or other proprietary rights notice from any Content.',
            'Attempt to impersonate another user or person or use the username of another user.',
            'Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats ("gifs"), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as "spyware" or "passive collection mechanisms" or "pcms").',
            'Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.',
            'Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.',
            'Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.',
            "Copy or adapt the Services' software, including but not limited to Flash, PHP, HTML, JavaScript, or other code.",
            'Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.',
            'Except as may be the result of standard search engine or Internet browser usage, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorized script or other software.',
            'Use a buying agent or purchasing agent to make purchases on the Services.',
            'Make any unauthorized use of the Services, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses.',
            'Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.',
            'Sell or otherwise transfer your profile.',
            'Use the Services to advertise or offer to sell goods and services.'
          ].map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section id="ugc" number={9} title="USER GENERATED CONTRIBUTIONS">
        <p>
          The Services may invite you to chat, contribute to, or participate in
          blogs, message boards, online forums, and other functionality, and may
          provide you with the opportunity to create, submit, post, display,
          transmit, perform, publish, distribute, or broadcast content and
          materials to us or on the Services, including but not limited to text,
          writings, video, audio, photographs, graphics, comments, suggestions,
          or personal information or other material (collectively,
          &quot;Contributions&quot;). Contributions may be viewable by other
          users of the Services and through third-party websites. As such, any
          Contributions you transmit may be treated as non-confidential and
          non-proprietary. When you create or make available any Contributions,
          you thereby represent and warrant that:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
          {[
            'The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.',
            'You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.',
            'You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Services and these Legal Terms.',
            'Your Contributions are not false, inaccurate, or misleading.',
            'Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.',
            'Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, or otherwise objectionable (as determined by us).',
            'Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.',
            'Your Contributions are not used to harass or threaten (in the legal sense of those terms) any other person and to promote violence against a specific person or class of people.',
            'Your Contributions do not violate any applicable law, regulation, or rule.',
            'Your Contributions do not violate the privacy or publicity rights of any third party.',
            'Your Contributions do not violate any applicable law concerning child pornography, or otherwise intended to protect the health or well-being of minors.',
            'Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.',
            'Your Contributions do not otherwise violate, or link to material that violates, any provision of these Legal Terms, or any applicable law or regulation.'
          ].map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-3">
          Any use of the Services in violation of the foregoing violates these
          Legal Terms and may result in, among other things, termination or
          suspension of your rights to use the Services.
        </p>
      </Section>

      <Section id="license" number={10} title="CONTRIBUTION LICENSE">
        <p>
          By posting your Contributions to any part of the Services, you
          automatically grant, and you represent and warrant that you have the
          right to grant, to us an unrestricted, unlimited, irrevocable,
          perpetual, non-exclusive, transferable, royalty-free, fully-paid,
          worldwide right, and license to host, use, copy, reproduce, disclose,
          sell, resell, publish, broadcast, retitle, archive, store, cache,
          publicly perform, publicly display, reformat, translate, transmit,
          excerpt (in whole or in part), and distribute such Contributions
          (including, without limitation, your image and voice) for any purpose,
          commercial, advertising, or otherwise, and to prepare derivative works
          of, or incorporate into other works, such Contributions, and grant and
          authorize sublicenses of the foregoing. The use and distribution may
          occur in any media formats and through any media channels.
        </p>
        <p className="mt-3">
          This license will apply to any form, media, or technology now known or
          hereafter developed, and includes our use of your name, company name,
          and franchise name, as applicable, and any of the trademarks, service
          marks, trade names, logos, and personal and commercial images you
          provide. You waive all moral rights in your Contributions, and you
          warrant that moral rights have not otherwise been asserted in your
          Contributions.
        </p>
        <p className="mt-3">
          We do not assert any ownership over your Contributions. You retain
          full ownership of all of your Contributions and any intellectual
          property rights or other proprietary rights associated with your
          Contributions. We are not liable for any statements or representations
          in your Contributions provided by you in any area on the Services. You
          are solely responsible for your Contributions to the Services and you
          expressly agree to exonerate us from any and all responsibility and to
          refrain from any legal action against us regarding your Contributions.
        </p>
        <p className="mt-3">
          We have the right, in our sole and absolute discretion, (1) to edit,
          redact, or otherwise change any Contributions; (2) to re-categorize
          any Contributions to place them in more appropriate locations on the
          Services; and (3) to pre-screen or delete any Contributions at any
          time and for any reason, without notice. We have no obligation to
          monitor your Contributions.
        </p>
      </Section>

      <Section id="reviews" number={11} title="GUIDELINES FOR REVIEWS">
        <p>
          We may provide you areas on the Services to leave reviews or ratings.
          When posting a review, you must comply with the following criteria:
          (1) you should have firsthand experience with the person/entity being
          reviewed; (2) your reviews should not contain offensive profanity, or
          abusive, racist, offensive, or hateful language; (3) your reviews
          should not contain discriminatory references based on religion, race,
          gender, national origin, age, marital status, sexual orientation, or
          disability; (4) your reviews should not contain references to illegal
          activity; (5) you should not be affiliated with competitors if posting
          negative reviews; (6) you should not make any conclusions as to the
          legality of conduct; (7) you may not post any false or misleading
          statements; and (8) you may not organize a campaign encouraging others
          to post reviews, whether positive or negative.
        </p>
        <p className="mt-3">
          We may accept, reject, or remove reviews in our sole discretion. We
          have absolutely no obligation to screen reviews or to delete reviews,
          even if anyone considers reviews objectionable or inaccurate. Reviews
          are not endorsed by us, and do not necessarily represent our opinions
          or the views of any of our affiliates or partners. We do not assume
          liability for any review or for any claims, liabilities, or losses
          resulting from any review. By posting a review, you hereby grant to us
          a perpetual, non-exclusive, worldwide, royalty-free, fully paid,
          assignable, and sublicensable right and license to reproduce, modify,
          translate, transmit by any means, display, perform, and/or distribute
          all content relating to review.
        </p>
      </Section>

      <Section id="advertisers" number={12} title="ADVERTISERS">
        <p>
          We allow advertisers to display their advertisements and other
          information in certain areas of the Services, such as sidebar
          advertisements or banner advertisements. We simply provide the space
          to place such advertisements, and we have no other relationship with
          advertisers.
        </p>
      </Section>

      <Section id="sitemanage" number={13} title="SERVICES MANAGEMENT">
        <p>
          We reserve the right, but not the obligation, to: (1) monitor the
          Services for violations of these Legal Terms; (2) take appropriate
          legal action against anyone who, in our sole discretion, violates the
          law or these Legal Terms, including without limitation, reporting such
          user to law enforcement authorities; (3) in our sole discretion and
          without limitation, refuse, restrict access to, limit the availability
          of, or disable (to the extent technologically feasible) any of your
          Contributions or any portion thereof; (4) in our sole discretion and
          without limitation, notice, or liability, to remove from the Services
          or otherwise disable all files and content that are excessive in size
          or are in any way burdensome to our systems; and (5) otherwise manage
          the Services in a manner designed to protect our rights and property
          and to facilitate the proper functioning of the Services.
        </p>
      </Section>

      <Section id="privacy" number={14} title="PRIVACY POLICY">
        <p>
          We care about data privacy and security. By using the Services, you
          agree to be bound by our Privacy Policy posted on the Services, which
          is incorporated into these Legal Terms. Please be advised the Services
          are hosted in the United States. If you access the Services from any
          other region of the world with laws or other requirements governing
          personal data collection, use, or disclosure that differ from
          applicable laws in the United States, then through your continued use
          of the Services, you are transferring your data to the United States,
          and you expressly consent to have your data transferred to and
          processed in the United States.
        </p>
      </Section>

      <Section
        id="dmca"
        number={15}
        title="DIGITAL MILLENNIUM COPYRIGHT ACT (DMCA) NOTICE AND POLICY"
      >
        <Subsection title="Notifications">
          <p>
            We respect the intellectual property rights of others. If you
            believe that any material available on or through the Services
            infringes upon any copyright you own or control, please immediately
            notify our Designated Copyright Agent using the contact information
            provided below (a &quot;Notification&quot;). A copy of your
            Notification will be sent to the person who posted or stored the
            material addressed in the Notification. Please be advised that
            pursuant to federal law you may be held liable for damages if you
            make material misrepresentations in a Notification. Thus, if you are
            not sure that material located on or linked to by the Services
            infringes your copyright, you should consider first contacting an
            attorney.
          </p>
          <p className="mt-3">
            All Notifications should meet the requirements of DMCA 17 U.S.C. §
            512(c)(3) and include the following information: (1) A physical or
            electronic signature of a person authorized to act on behalf of the
            owner of an exclusive right that is allegedly infringed; (2)
            identification of the copyrighted work claimed to have been
            infringed, or, if multiple copyrighted works on the Services are
            covered by the Notification, a representative list of such works on
            the Services; (3) identification of the material that is claimed to
            be infringing or to be the subject of infringing activity and that
            is to be removed or access to which is to be disabled, and
            information reasonably sufficient to permit us to locate the
            material; (4) information reasonably sufficient to permit us to
            contact the complaining party, such as an address, telephone number,
            and, if available, an email address at which the complaining party
            may be contacted; (5) a statement that the complaining party has a
            good faith belief that use of the material in the manner complained
            of is not authorized by the copyright owner, its agent, or the law;
            and (6) a statement that the information in the notification is
            accurate, and under penalty of perjury, that the complaining party
            is authorized to act on behalf of the owner of an exclusive right
            that is allegedly infringed upon.
          </p>
        </Subsection>

        <Subsection title="Counter Notification">
          <p>
            If you believe your own copyrighted material has been removed from
            the Services as a result of a mistake or misidentification, you may
            submit a written counter notification to our Designated Copyright
            Agent using the contact information provided below (a &quot;Counter
            Notification&quot;). To be an effective Counter Notification under
            the DMCA, your Counter Notification must include substantially the
            following: (1) identification of the material that has been removed
            or disabled and the location at which the material appeared before
            it was removed or disabled; (2) a statement that you consent to the
            jurisdiction of the Federal District Court in which your address is
            located, or if your address is outside the United States, for any
            judicial district in which we are located; (3) a statement that you
            will accept service of process from the party that filed the
            Notification or the party&apos;s agent; (4) your name, address, and
            telephone number; (5) a statement under penalty of perjury that you
            have a good faith belief that the material in question was removed
            or disabled as a result of a mistake or misidentification of the
            material to be removed or disabled; and (6) your physical or
            electronic signature.
          </p>
          <p className="mt-3">
            If you send us a valid, written Counter Notification meeting the
            requirements described above, we will restore your removed or
            disabled material, unless we first receive notice from the party
            filing the Notification informing us that such party has filed a
            court action to restrain you from engaging in infringing activity
            related to the material in question. Please note that if you
            materially misrepresent that the disabled or removed content was
            removed by mistake or misidentification, you may be liable for
            damages, including costs and attorney&apos;s fees. Filing a false
            Counter Notification constitutes perjury.
          </p>
        </Subsection>

        <Subsection title="Designated Copyright Agent">
          <address className="not-italic mt-2 space-y-1">
            <p>Jay Lingelbach</p>
            <p>Attn: Copyright Agent</p>
            <p>{BUSINESS_STREET}</p>
            <p>{BUSINESS_CITY_STATE_ZIP}</p>
            <p>{BUSINESS_COUNTRY}</p>
            <p>
              <a href={EMAIL_HREF_JAY} className="text-blue-600 underline">
                {EMAIL_DISPLAY_JAY}
              </a>
            </p>
          </address>
        </Subsection>
      </Section>

      <Section id="termination" number={16} title="TERM AND TERMINATION">
        <p>
          These Legal Terms shall remain in full force and effect while you use
          the Services. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL
          TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT
          NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING
          BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO
          REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION,
          WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY
          APPLICABLE LAW OR REGULATION. WE MAY TERMINATE YOUR USE OR
          PARTICIPATION IN THE SERVICES OR DELETE YOUR ACCOUNT AND ANY CONTENT
          OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR
          SOLE DISCRETION.
        </p>
        <p className="mt-3">
          If we terminate or suspend your account for any reason, you are
          prohibited from registering and creating a new account under your
          name, a fake or borrowed name, or the name of any third party, even if
          you may be acting on behalf of the third party. In addition to
          terminating or suspending your account, we reserve the right to take
          appropriate legal action, including without limitation pursuing civil,
          criminal, and injunctive redress.
        </p>
      </Section>

      <Section
        id="modifications"
        number={17}
        title="MODIFICATIONS AND INTERRUPTIONS"
      >
        <p>
          We reserve the right to change, modify, or remove the contents of the
          Services at any time or for any reason at our sole discretion without
          notice. However, we have no obligation to update any information on
          our Services. We also reserve the right to modify or discontinue all
          or part of the Services without notice at any time. We will not be
          liable to you or any third party for any modification, price change,
          suspension, or discontinuance of the Services.
        </p>
        <p className="mt-3">
          We cannot guarantee the Services will be available at all times. We
          may experience hardware, software, or other problems or need to
          perform maintenance related to the Services, resulting in
          interruptions, delays, or errors. We reserve the right to change,
          revise, update, suspend, discontinue, or otherwise modify the Services
          at any time or for any reason without notice to you. You agree that we
          have no liability whatsoever for any loss, damage, or inconvenience
          caused by your inability to access or use the Services during any
          downtime or discontinuance of the Services. Nothing in these Legal
          Terms will be construed to obligate us to maintain and support the
          Services or to supply any corrections, updates, or releases in
          connection therewith.
        </p>
      </Section>

      <Section id="law" number={18} title="GOVERNING LAW">
        <p>
          These Legal Terms and your use of the Services are governed by and
          construed in accordance with the laws of the State of Illinois
          applicable to agreements made and to be entirely performed within the
          State of Illinois, without regard to its conflict of law principles.
        </p>
      </Section>

      <Section id="disputes" number={19} title="DISPUTE RESOLUTION">
        <p>
          Any legal action of whatever nature brought by either you or us
          (collectively, the &quot;Parties&quot; and individually, a &quot;Party&quot;) shall be
          commenced or prosecuted in the state courts of competent jurisdiction
          in St. Clair County, Illinois, or the United States District Court for
          the Southern District of Illinois, Eastern Division. The Parties
          consent to personal jurisdiction in these courts and waive all
          defenses of lack of personal jurisdiction and forum non conveniens
          with respect to such venues.
        </p>
      </Section>

      <Section id="corrections" number={20} title="CORRECTIONS">
        <p>
          There may be information on the Services that contains typographical
          errors, inaccuracies, or omissions, including descriptions, pricing,
          availability, and various other information. We reserve the right to
          correct any errors, inaccuracies, or omissions and to change or update
          the information on the Services at any time, without prior notice.
        </p>
      </Section>

      <Section id="disclaimer" number={21} title="DISCLAIMER">
        <p>
          THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU
          AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE
          FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS
          OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF,
          INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE
          ACCURACY OR COMPLETENESS OF THE SERVICES&apos; CONTENT OR THE CONTENT
          OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE
          WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS,
          MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL
          INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM
          YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO
          OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION
          AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR
          CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS,
          VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR
          THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR
          OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF
          ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED,
          TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES. WE DO NOT
          WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT
          OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE
          SERVICES, ANY HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE
          APPLICATION FEATURED IN ANY BANNER OR OTHER ADVERTISING, AND WE WILL
          NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY
          TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR
          SERVICES. AS WITH THE PURCHASE OF A PRODUCT OR SERVICE THROUGH ANY
          MEDIUM OR IN ANY ENVIRONMENT, YOU SHOULD USE YOUR BEST JUDGMENT AND
          EXERCISE CAUTION WHERE APPROPRIATE.
        </p>
      </Section>

      <Section id="liability" number={22} title="LIMITATIONS OF LIABILITY">
        <p>
          IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE
          TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL,
          EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST
          PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR
          USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY
          OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED
          HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS
          OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE AMOUNT
          PAID, IF ANY, BY YOU TO US. CERTAIN US STATE LAWS AND INTERNATIONAL
          LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION
          OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR
          ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND
          YOU MAY HAVE ADDITIONAL RIGHTS.
        </p>
      </Section>

      <Section id="indemnification" number={23} title="INDEMNIFICATION">
        <p>
          You agree to defend, indemnify, and hold us harmless, including our
          subsidiaries, affiliates, and all of our respective officers, agents,
          partners, and employees, from and against any loss, damage, liability,
          claim, or demand, including reasonable attorneys&apos; fees and
          expenses, made by any third party due to or arising out of: (1) your
          Contributions; (2) use of the Services; (3) breach of these Legal
          Terms; (4) any breach of your representations and warranties set forth
          in these Legal Terms; (5) your violation of the rights of a third
          party, including but not limited to intellectual property rights; or
          (6) any overt harmful act toward any other user of the Services with
          whom you connected via the Services. Notwithstanding the foregoing, we
          reserve the right, at your expense, to assume the exclusive defense
          and control of any matter for which you are required to indemnify us,
          and you agree to cooperate, at your expense, with our defense of such
          claims. We will use reasonable efforts to notify you of any such
          claim, action, or proceeding which is subject to this indemnification
          upon becoming aware of it.
        </p>
      </Section>

      <Section id="userdata" number={24} title="USER DATA">
        <p>
          We will maintain certain data that you transmit to the Services for
          the purpose of managing the performance of the Services, as well as
          data relating to your use of the Services. Although we perform regular
          routine backups of data, you are solely responsible for all data that
          you transmit or that relates to any activity you have undertaken using
          the Services. You agree that we shall have no liability to you for any
          loss or corruption of any such data, and you hereby waive any right of
          action against us arising from any such loss or corruption of such
          data.
        </p>
      </Section>

      <Section
        id="electronic"
        number={25}
        title="ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES"
      >
        <p>
          Visiting the Services, sending us emails, and completing online forms
          constitute electronic communications. You consent to receive
          electronic communications, and you agree that all agreements, notices,
          disclosures, and other communications we provide to you
          electronically, via email and on the Services, satisfy any legal
          requirement that such communication be in writing. YOU HEREBY AGREE TO
          THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER
          RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS
          OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES. You
          hereby waive any rights or requirements under any statutes,
          regulations, rules, ordinances, or other laws in any jurisdiction
          which require an original signature or delivery or retention of
          non-electronic records, or to payments or the granting of credits by
          any means other than electronic means.
        </p>
      </Section>

      <Section
        id="california"
        number={26}
        title="CALIFORNIA USERS AND RESIDENTS"
      >
        <p>
          If any complaint with us is not satisfactorily resolved, you can
          contact the Complaint Assistance Unit of the Division of Consumer
          Services of the California Department of Consumer Affairs in writing
          at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834
          or by telephone at (800) 952-5210 or (916) 445-1254.
        </p>
      </Section>

      <Section id="misc" number={27} title="MISCELLANEOUS">
        <p>
          These Legal Terms and any policies or operating rules posted by us on
          the Services or in respect to the Services constitute the entire
          agreement and understanding between you and us. Our failure to
          exercise or enforce any right or provision of these Legal Terms shall
          not operate as a waiver of such right or provision. These Legal Terms
          operate to the fullest extent permissible by law. We may assign any or
          all of our rights and obligations to others at any time. We shall not
          be responsible or liable for any loss, damage, delay, or failure to
          act caused by any cause beyond our reasonable control. If any
          provision or part of a provision of these Legal Terms is determined to
          be unlawful, void, or unenforceable, that provision or part of the
          provision is deemed severable from these Legal Terms and does not
          affect the validity and enforceability of any remaining provisions.
          There is no joint venture, partnership, employment or agency
          relationship created between you and us as a result of these Legal
          Terms or use of the Services. You agree that these Legal Terms will
          not be construed against us by virtue of having drafted them. You
          hereby waive any and all defenses you may have based on the electronic
          form of these Legal Terms and the lack of signing by the parties
          hereto to execute these Legal Terms.
        </p>
      </Section>

      <Section id="contact" number={28} title="CONTACT US">
        <p>
          In order to resolve a complaint regarding the Services or to receive
          further information regarding use of the Services, please contact us
          at:
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
          <p>
            <a href={EMAIL_HREF_JAY} className="text-blue-600 underline">
              {EMAIL_DISPLAY_JAY}
            </a>
          </p>
        </address>
      </Section>
    </div>
  );
}

function Section({
  id,
  number,
  title,
  children
}: {
  id?: string;
  number?: number;
  title: string;
  children: ReactNode;
}) {
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
