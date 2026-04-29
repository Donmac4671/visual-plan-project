/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  recipient,
  token,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} verification code: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Heading style={brand}>{siteName}</Heading>
        </Section>
        <Heading style={h1}>Verify your email</Heading>
        <Text style={text}>
          Welcome to <strong>{siteName}</strong>! Use the verification code below to confirm your email address ({recipient}).
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{token}</Text>
        </Section>
        <Text style={text}>
          This code expires in 1 hour. Enter it on the verification page to activate your account.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't create an account with {siteName}, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const brandBar = { padding: '16px 0', borderBottom: '2px solid hsl(246, 65%, 56%)', marginBottom: '24px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(246, 65%, 56%)', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(222, 84%, 4.9%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(215, 16.3%, 46.9%)', lineHeight: '1.6', margin: '0 0 20px' }
const codeBox = {
  backgroundColor: 'hsl(246, 65%, 97%)',
  border: '2px solid hsl(246, 65%, 56%)',
  borderRadius: '12px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '24px 0',
}
const codeText = {
  fontSize: '36px',
  fontWeight: 'bold' as const,
  color: 'hsl(246, 65%, 56%)',
  letterSpacing: '8px',
  margin: '0',
  fontFamily: 'monospace',
}
const hr = { borderColor: 'hsl(214, 31.8%, 91.4%)', margin: '28px 0 20px' }
const footer = { fontSize: '12px', color: 'hsl(215, 16.3%, 46.9%)', margin: '0' }
