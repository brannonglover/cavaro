import React, { useEffect, useState } from "react";
import { styled } from 'styled-components';
import ServiceBox from "./components/service-box";
import IndividualBox from "./components/individual-box";
import config from './assets/siteConfig.json';
import BikeLogo from './images/bike-repair.png';
import HeaderImage from './images/header-image.jpeg';

const PageWrapper = styled.div`
  margin: 0 auto;
  padding: 0;
`;

const PageHeader = styled.section`
  background-color: #000;
  text-align: center;
  padding: 1rem;
  border-bottom: 2px solid #E1AE8B;

  @media screen and (min-width: 1000px) {
    display: flex;
    align-items: center;
    padding: 5rem 1rem 1rem;
    background-color: unset;
    background-image: url(${HeaderImage});
    background-size: cover;
    background-position: 0 -10rem;
    background-repeat: no-repeat;
  }
`;


const Title = styled.h1`
  width: 16rem;
  font-size: 1.3rem;
  font-family: Arial, Helvetica, sans-serif;
  color: #fff;
  margin: 0 auto;
  padding-top: .5rem;

  @media screen and (min-width: 1000px) {
    font-size: 2rem;
    font-weight: bold;
    text-align: center;
    margin: 0;
    width: auto;
  }
`;

const Logo = styled.img`
  width: 5rem;
  padding-right: 1rem;
`;

const ServiceHeader = styled.h2`
  margin: 0;
  text-align: center;
  padding: 2rem 0 0;
  font-size: 2rem;
  font-family: Arial, Helvetica, sans-serif;
`;

const MyServices = styled.section`
  margin: 0 auto;
  padding-top: 1rem;
  width: 100%;
  font-size: 1rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
`;

const IndividualServices = styled.section`
  display: grid;
  justify-content: center;
  align-items: center;
  margin: 0 auto;
  padding-top: 1rem;

  @media screen and (min-width: 1000px) {
    grid-template-columns: 1fr 1fr;
    width: 53rem;
    column-gap: 1rem;
  }
`;

const BreakLine = styled.div`
  width: 50%;
  background-color: #7a7979;
  height: 2px;
  padding: 0;
  margin: 5rem auto 1rem;
`;

const MyEmail = styled.div`
  padding-top: 4rem;
  padding-bottom: 2rem;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 1.3rem;
  text-align: center;

  a {
    text-decoration: none;
  }
`;

const App = () => {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    }
  }, []);

  return (
    <PageWrapper>
      <PageHeader>
        <Logo src={BikeLogo} alt={config.title} />
        <Title>{config.title} {width < 1000 && <a href={`tel:${config.phone}`}>{config.phone}</a>}</Title>
      </PageHeader>
      <ServiceHeader>{ config.service_header }</ServiceHeader>
      <MyServices>
        {config.services.map(item => <ServiceBox services={item} key={item.id} />)}
      </MyServices>
      <BreakLine />
      <ServiceHeader>{ config.additional_services }</ServiceHeader>
      <IndividualServices>
        {config.individual_services.map(item => <IndividualBox services={item} key={item.id} />)}
      </IndividualServices>
      <MyEmail>Contact Me @: <a href={`mailto:${config.email}`}>{config.email}</a> or <a href={`tel:${config.phone}`}>{config.phone}</a></MyEmail>
    </PageWrapper>
  )
}

export default App;
