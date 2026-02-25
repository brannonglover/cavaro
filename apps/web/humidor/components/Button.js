import { Text, View } from "react-native"
import styled from 'styled-components/native'


const Button = ({ text, bgColor, shape, setAddFaveCigar }) => {
  let roundStyle = {}
  if (shape === 'round') {
    
  }

  return (
    <ButtonContainer bgColor={bgColor} style={{ ...roundStyle }} onPress={setAddFaveCigar}>
      <Text>{text}</Text>
      {shape && (
        <AddCigarBtn>
          <FontAwesomeIcon icon={faPlus} size={30} color={'#fff'} />
        </AddCigarBtn>
      )}
    </ButtonContainer>
  )
}

export default Button



export const ButtonContainer = styled.Pressable`
  /* padding: 10px 20px; */
  
`

export const AddCigarBtn = styled.View`
  
`