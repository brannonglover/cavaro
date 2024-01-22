import React from 'react';
import { styled } from 'styled-components';

const IndividualBoxWrapper = styled.div`
  display: grid;
  align-items: center;
  grid-template-columns: 20rem 1fr;

  @media screen and (min-width: 1000px) {
    grid-template-columns: 23rem 3rem;
    justify-content: center;
  }
`;

const ServiceBoxName = styled.span`
  padding: 1rem 0;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 19px;
`;

const ServicePrice = styled.span`
  font-size: 19px;
  font-family: Arial, Helvetica, sans-serif;
  font-weight: 700;
  padding: .5rem 0;
`;

const ServiceBox = ({ services }) => {
  return (
    <IndividualBoxWrapper>
      <ServiceBoxName>{services.service}</ServiceBoxName>
      <ServicePrice>${ services.price }</ServicePrice>
    </IndividualBoxWrapper>
  )
}

export default ServiceBox;