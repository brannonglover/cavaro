import React from 'react';
import { styled } from 'styled-components';

const ServiceBoxWrapper = styled.div`
  width: 100%;
  padding-top: 1rem;

  @media screen and (min-width: 1000px) {
    width: 50%;
  }
`;

const ServiceBoxName = styled.h3`
  padding: 1rem;
  margin: 0 1rem;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 1.7rem;
  color: #fff;
  text-align: center;
  background-color: #3A8BC5;
`;

const ServicePrice = styled.div`
  text-align: center;
  font-size: 1.3rem;
  font-family: Arial, Helvetica, sans-serif;
  font-weight: 700;
  background-color: #cee3f0;
  margin: 0 1rem;
  padding: .5rem 0;
`;

const ServiceList = styled.div`
  background-color: #faf7f7;
  margin: 0 1rem;
  ul {
    margin: 0;
    padding: 1rem 0 1rem 2rem;
  }
  li {
    font-size: 1.3rem;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 35px;
    padding-bottom: 0.7rem;
  }
`;

const ServiceBox = ({ services }) => {
  return (
    <ServiceBoxWrapper>
      <ServiceBoxName>{services.service}</ServiceBoxName>
      <ServicePrice>${ services.price }</ServicePrice>
      <ServiceList>
        <ul>
          {services.list?.map(item => <li key={item.id}>{item.task}</li>)}
        </ul>
      </ServiceList>
    </ServiceBoxWrapper>
  )
}

export default ServiceBox;